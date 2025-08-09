import { auth } from '$lib/auth'
import { error, json } from '@sveltejs/kit'
import { db } from '$lib/server/db'
import { coin, user, userPortfolio, transaction, priceHistory } from '$lib/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { calculate24hMetrics } from '$lib/server/amm'
import { redis } from '$lib/server/redis'

interface SwapRequestBody {
  fromSymbol: string
  toSymbol: string
  fromAmount: number
  slippageBps?: number // ignored; swap follows AMM like SELL (no extra tolerance)
  quoteOnly?: boolean
}

export async function POST({ request }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw error(401, 'Not authenticated')

  const body = (await request.json()) as SwapRequestBody
  const { fromSymbol, toSymbol, fromAmount, quoteOnly = false } = body

  if (!fromSymbol || !toSymbol) throw error(400, 'fromSymbol and toSymbol are required')
  if (fromSymbol.toUpperCase() === toSymbol.toUpperCase()) throw error(400, 'Cannot swap the same asset')
  if (!fromAmount || typeof fromAmount !== 'number' || !Number.isFinite(fromAmount) || fromAmount <= 0) throw error(400, 'Invalid fromAmount')
  if (fromAmount > Number.MAX_SAFE_INTEGER) throw error(400, 'Amount too large')

  const userId = Number(session.user.id)
  const from = fromSymbol.toUpperCase()
  const to = toSymbol.toUpperCase()

  return await db.transaction(async (tx) => {
    // Lock both coin rows
    const [fromCoin] = await tx
      .select({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        icon: coin.icon,
        currentPrice: coin.currentPrice,
        poolCoinAmount: coin.poolCoinAmount,
        poolBaseCurrencyAmount: coin.poolBaseCurrencyAmount,
        circulatingSupply: coin.circulatingSupply,
        isListed: coin.isListed,
        creatorId: coin.creatorId,
        tradingUnlocksAt: coin.tradingUnlocksAt,
        isLocked: coin.isLocked
      })
      .from(coin)
      .where(eq(coin.symbol, from))
      .for('update')
      .limit(1)

    const [toCoin] = await tx
      .select({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        icon: coin.icon,
        currentPrice: coin.currentPrice,
        poolCoinAmount: coin.poolCoinAmount,
        poolBaseCurrencyAmount: coin.poolBaseCurrencyAmount,
        circulatingSupply: coin.circulatingSupply,
        isListed: coin.isListed,
        creatorId: coin.creatorId,
        tradingUnlocksAt: coin.tradingUnlocksAt,
        isLocked: coin.isLocked
      })
      .from(coin)
      .where(eq(coin.symbol, to))
      .for('update')
      .limit(1)

    if (!fromCoin || !toCoin) throw error(404, 'Coin not found')
    if (!fromCoin.isListed || !toCoin.isListed) throw error(400, 'One of the coins is delisted')

    // Basic trade lock checks (allow creator bypass for locked coin)
    const now = new Date()
    if (fromCoin.isLocked && fromCoin.tradingUnlocksAt && userId !== fromCoin.creatorId && now < new Date(fromCoin.tradingUnlocksAt)) {
      throw error(400, 'From coin trading is locked')
    }
    if (toCoin.isLocked && toCoin.tradingUnlocksAt && userId !== toCoin.creatorId && now < new Date(toCoin.tradingUnlocksAt)) {
      throw error(400, 'To coin trading is locked')
    }

    // User must have enough of fromCoin
    const [holding] = await tx
      .select({ quantity: userPortfolio.quantity })
      .from(userPortfolio)
      .where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, fromCoin.id)))
      .limit(1)
    const userQty = holding ? Number(holding.quantity) : 0
    if (userQty < fromAmount) throw error(400, `Insufficient ${fromCoin.symbol}. You have ${userQty}`)

    const fromPoolCoin = Number(fromCoin.poolCoinAmount)
    const fromPoolBase = Number(fromCoin.poolBaseCurrencyAmount)
    const toPoolCoin = Number(toCoin.poolCoinAmount)
    const toPoolBase = Number(toCoin.poolBaseCurrencyAmount)

    if (fromPoolCoin <= 0 || fromPoolBase <= 0 || toPoolCoin <= 0 || toPoolBase <= 0) throw error(400, 'One of the pools has no liquidity')

    // Do not allow draining almost entire pool in one swap
    const maxSellableFrom = Math.floor(fromPoolCoin * 0.995)
    if (fromAmount > maxSellableFrom) throw error(400, `Cannot swap more than 99.5% of pool tokens for ${fromCoin.symbol}`)

    // Step 1: Sell fromCoin -> base
    const kFrom = fromPoolCoin * fromPoolBase
    const newFromPoolCoin = fromPoolCoin + fromAmount
    const newFromPoolBase = kFrom / newFromPoolCoin
    const baseOut = fromPoolBase - newFromPoolBase
    if (baseOut <= 0) throw error(400, 'Swap too small to produce output')

    // Step 2: Buy toCoin with baseOut
    const kTo = toPoolCoin * toPoolBase
    const newToPoolBase = toPoolBase + baseOut
    const newToPoolCoin = kTo / newToPoolBase
    const coinsBought = toPoolCoin - newToPoolCoin
    if (coinsBought <= 0) throw error(400, 'Swap too small to produce output')

    const effectivePriceFrom = baseOut / fromAmount // base per fromCoin
    const effectivePriceTo = baseOut / coinsBought // base per toCoin
    const priceImpactFrom = ((newFromPoolBase / newFromPoolCoin) / (fromPoolBase / fromPoolCoin) - 1) * 100
    const priceImpactTo = ((newToPoolBase / newToPoolCoin) / (toPoolBase / toPoolCoin) - 1) * 100
    const minCoinsOut = coinsBought // No extra tolerance; mirrors SELL behavior

    // Quote path: return preview only
    if (quoteOnly) {
      return json({
        success: true,
        quote: {
          fromSymbol: fromCoin.symbol,
          toSymbol: toCoin.symbol,
          fromAmount,
          baseOut,
          coinsOut: coinsBought,
          minCoinsOut,
          effectivePriceFrom,
          effectivePriceTo,
          priceImpactFrom,
          priceImpactTo
        }
      })
    }

    // No separate slippage tolerance enforcement (same as SELL)

    // Update user portfolio: subtract fromCoin, add toCoin
    const newFromQty = userQty - fromAmount
    if (newFromQty > 0.000001) {
      await tx
        .update(userPortfolio)
        .set({ quantity: newFromQty.toString(), updatedAt: new Date() })
        .where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, fromCoin.id)))
    } else {
      await tx
        .delete(userPortfolio)
        .where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, fromCoin.id)))
    }

    const [existingToHolding] = await tx
      .select({ quantity: userPortfolio.quantity })
      .from(userPortfolio)
      .where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, toCoin.id)))
      .limit(1)

    if (existingToHolding) {
      const newQty = Number(existingToHolding.quantity) + coinsBought
      await tx
        .update(userPortfolio)
        .set({ quantity: newQty.toString(), updatedAt: new Date() })
        .where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, toCoin.id)))
    } else {
      await tx.insert(userPortfolio).values({ userId, coinId: toCoin.id, quantity: coinsBought.toString() })
    }

    // Update both pools and prices
    const newFromPrice = newFromPoolBase / newFromPoolCoin
    const fromMetrics = await calculate24hMetrics(fromCoin.id, newFromPrice)
    await tx
      .update(coin)
      .set({
        currentPrice: newFromPrice.toString(),
        marketCap: (Number(fromCoin.circulatingSupply) * newFromPrice).toString(),
        poolCoinAmount: newFromPoolCoin.toString(),
        poolBaseCurrencyAmount: newFromPoolBase.toString(),
        change24h: fromMetrics.change24h.toString(),
        volume24h: fromMetrics.volume24h.toString(),
        updatedAt: new Date()
      })
      .where(eq(coin.id, fromCoin.id))

    const newToPrice = newToPoolBase / newToPoolCoin
    const toMetrics = await calculate24hMetrics(toCoin.id, newToPrice)
    await tx
      .update(coin)
      .set({
        currentPrice: newToPrice.toString(),
        marketCap: (Number(toCoin.circulatingSupply) * newToPrice).toString(),
        poolCoinAmount: newToPoolCoin.toString(),
        poolBaseCurrencyAmount: newToPoolBase.toString(),
        change24h: toMetrics.change24h.toString(),
        volume24h: toMetrics.volume24h.toString(),
        updatedAt: new Date()
      })
      .where(eq(coin.id, toCoin.id))

    // Record transactions and price history for both legs
    await tx.insert(priceHistory).values([
      { coinId: fromCoin.id, price: newFromPrice.toString() },
      { coinId: toCoin.id, price: newToPrice.toString() }
    ])

    await tx.insert(transaction).values([
      {
        userId,
        coinId: fromCoin.id,
        type: 'SELL',
        quantity: fromAmount.toString(),
        pricePerCoin: (baseOut / fromAmount).toString(),
        totalBaseCurrencyAmount: baseOut.toString()
      },
      {
        userId,
        coinId: toCoin.id,
        type: 'BUY',
        quantity: coinsBought.toString(),
        pricePerCoin: (baseOut / coinsBought).toString(),
        totalBaseCurrencyAmount: baseOut.toString()
      }
    ])

    // Publish price updates
    await redis.publish(`prices:${fromCoin.symbol}`, JSON.stringify({
      currentPrice: newFromPrice,
      marketCap: Number(fromCoin.circulatingSupply) * newFromPrice,
      change24h: fromMetrics.change24h,
      volume24h: fromMetrics.volume24h,
      poolCoinAmount: newFromPoolCoin,
      poolBaseCurrencyAmount: newFromPoolBase
    }))

    await redis.publish(`prices:${toCoin.symbol}`, JSON.stringify({
      currentPrice: newToPrice,
      marketCap: Number(toCoin.circulatingSupply) * newToPrice,
      change24h: toMetrics.change24h,
      volume24h: toMetrics.volume24h,
      poolCoinAmount: newToPoolCoin,
      poolBaseCurrencyAmount: newToPoolBase
    }))

    return json({
      success: true,
      result: {
        fromSymbol: fromCoin.symbol,
        toSymbol: toCoin.symbol,
        fromAmount,
        coinsOut: coinsBought,
        minCoinsOut,
        baseIntermediary: baseOut,
        price: {
          fromLeg: effectivePriceFrom,
          toLeg: effectivePriceTo
        },
        priceImpact: {
          fromLeg: priceImpactFrom,
          toLeg: priceImpactTo
        }
      }
    })
  })
}


