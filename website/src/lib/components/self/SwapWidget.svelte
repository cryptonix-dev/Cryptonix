<script lang="ts">
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Label } from '$lib/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '$lib/components/ui/select'
	import { toast } from 'svelte-sonner'
	import { onMount } from 'svelte'
import { ArrowLeftRight, Info } from 'lucide-svelte'
import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip'

	interface QuoteResponse {
		success: boolean
		quote: {
			fromSymbol: string
			toSymbol: string
			fromAmount: number
			baseOut: number
			coinsOut: number
			minCoinsOut: number
			effectivePriceFrom: number
			effectivePriceTo: number
			priceImpactFrom: number
			priceImpactTo: number
		}
	}

	let { symbols = [] as string[] } = $props<{ symbols?: string[] }>()

	let fromSymbol = $state<string>('BTC')
	let toSymbol = $state<string>('ETH')
	let fromAmount = $state<number>(0)
    // Slippage tolerance matches SELL behavior (no extra tolerance)
    let slippageBps = $state<number>(0)
    let isQuoting = $state(false)
	let isSwapping = $state(false)
	let quote: QuoteResponse['quote'] | null = $state(null)
    let quoteError = $state<string | null>(null)
    let holdingsBySymbol = $state<Record<string, number>>({})
    let quoteDebounce: ReturnType<typeof setTimeout> | null = null

    onMount(async () => {
        if (symbols.length >= 2) {
            fromSymbol = symbols[0]
            toSymbol = symbols[1] === symbols[0] ? (symbols[2] || (symbols[0] !== 'BTC' ? 'BTC' : 'ETH')) : symbols[1]
        } else if (symbols.length === 1) {
            fromSymbol = symbols[0]
            toSymbol = symbols[0] !== 'BTC' ? 'BTC' : 'ETH'
        }

        // Load holdings to enable Max button
        try {
            const res = await fetch('/api/portfolio/total')
            if (res.ok) {
                const data = await res.json()
                const map: Record<string, number> = {}
                for (const h of (data?.coinHoldings ?? [])) {
                    if (h?.symbol) map[h.symbol] = Number(h.quantity) || 0
                }
                holdingsBySymbol = map
            }
        } catch {}
    })

    async function fetchQuote() {
        quoteError = null
        if (!fromAmount || fromAmount <= 0) return
        if (!fromSymbol || !toSymbol) return
        if (fromSymbol === toSymbol) { quote = null; quoteError = 'Select two different coins'; return }
		isQuoting = true
		quote = null
		try {
			const res = await fetch('/api/swap', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fromSymbol, toSymbol, fromAmount, slippageBps, quoteOnly: true })
			})
            if (!res.ok) {
                const errText = await res.text()
                throw new Error(errText || 'Quote failed')
            }
			const data = (await res.json()) as QuoteResponse
			quote = data.quote
        } catch (e: any) {
            quote = null
            quoteError = typeof e?.message === 'string' ? e.message : 'Failed to fetch quote'
		} finally {
			isQuoting = false
		}
	}

    function scheduleQuote() {
        if (quoteDebounce) clearTimeout(quoteDebounce)
        quoteDebounce = setTimeout(() => {
            fetchQuote()
        }, 250)
    }

    $effect(() => {
        // Recalculate when any relevant numeric or pair state changes
        // Debounced to avoid spamming while typing/scrolling
        void fromAmount; void slippageBps; void fromSymbol; void toSymbol;
        if (fromAmount && fromAmount > 0 && fromSymbol && toSymbol && fromSymbol !== toSymbol) {
            scheduleQuote()
        }
    })

	async function handleSwap() {
		if (!quote) {
			await fetchQuote()
			if (!quote) return
		}
		isSwapping = true
		try {
			const res = await fetch('/api/swap', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fromSymbol, toSymbol, fromAmount, slippageBps })
			})
			if (!res.ok) throw new Error(await res.text())
			toast.success('Swap completed')
			quote = null
			fromAmount = 0
		} catch (e) {
			toast.error('Swap failed')
		} finally {
			isSwapping = false
		}
	}

	function handleFlip() {
		const tmp = fromSymbol
		fromSymbol = toSymbol
		toSymbol = tmp
		quote = null
		if (fromAmount > 0) fetchQuote()
	}

    export async function submitSwap() {
        await handleSwap()
    }

    function handleMaxClick() {
        const max = holdingsBySymbol[fromSymbol] || 0
        fromAmount = max
        fetchQuote()
    }
</script>

<div class="space-y-4">
    <div class="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
		<div class="space-y-2">
			<Label for="from">From</Label>
			<Select bind:value={fromSymbol} on:change={fetchQuote}>
                <SelectTrigger id="from">{fromSymbol || 'Select coin'}</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{#each symbols as sym}
							<SelectItem value={sym}>{sym}</SelectItem>
						{/each}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
        <div class="flex items-center justify-center">
            <button
                type="button"
                class="bg-muted hover:bg-muted/80 text-foreground focus-visible:outline-ring inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                aria-label="Swap selected coins"
                tabindex="0"
                onclick={handleFlip}
                onkeydown={(e) => e.key === 'Enter' && handleFlip()}
            >
                <ArrowLeftRight class="h-4 w-4" />
            </button>
        </div>
        <div class="space-y-2">
			<Label for="to">To</Label>
			<Select bind:value={toSymbol} on:change={fetchQuote}>
                <SelectTrigger id="to">{toSymbol || 'Select coin'}</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{#each symbols as sym}
							<SelectItem value={sym}>{sym}</SelectItem>
						{/each}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	</div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="space-y-2 sm:col-span-2">
            <Label for="amount">Amount ({fromSymbol})</Label>
            <div class="flex items-center gap-2">
                <Input
                    id="amount"
                    class="flex-1"
                    type="number"
                    min="0"
                    step="any"
                    bind:value={fromAmount}
                    on:input={scheduleQuote}
                    on:change={scheduleQuote}
                    on:keydown={(e) => e.key === 'Enter' && fetchQuote()}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onclick={handleMaxClick}
                    aria-label="Set max"
                    tabindex="0"
                >
                    Max
                </Button>
            </div>
            <div class="text-muted-foreground text-xs">
                Available: <span class="font-medium">{(holdingsBySymbol[fromSymbol] || 0).toFixed(6)} {fromSymbol}</span>
            </div>
            <div class="space-y-1 pt-2">
                <div class="flex items-center gap-2">
                    <Label>Slippage</Label>
                    <Tooltip>
                        <TooltipTrigger>
                            <Info class="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                            Slippage tolerance follows SELL trades — no extra tolerance beyond AMM price impact.
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
            {#if quote}
                <p class="text-muted-foreground text-xs">Est. you receive: <span class="font-medium">{quote.coinsOut.toFixed(6)} {toSymbol}</span></p>
            {/if}
        </div>
        <div class="space-y-1">
        </div>
	</div>

    <!-- Swap button is provided by parent modal footer -->

	{#if isQuoting}
		<p class="text-sm text-muted-foreground">Getting quote…</p>
    {:else if quote}
		<div class="rounded-md border p-3 text-sm">
			<div class="flex justify-between"><span>Estimated Output</span><span class="font-medium">{quote.coinsOut.toFixed(6)} {toSymbol}</span></div>
			<div class="flex justify-between"><span>Minimum Received</span><span>{quote.minCoinsOut.toFixed(6)} {toSymbol}</span></div>
			<div class="flex justify-between"><span>Intermediary (Base)</span><span>{quote.baseOut.toFixed(6)}</span></div>
			<div class="flex justify-between"><span>Price Impact</span><span>{quote.priceImpactFrom.toFixed(2)}% → {quote.priceImpactTo.toFixed(2)}%</span></div>
		</div>
    {:else if quoteError}
        <p class="text-destructive text-sm">{quoteError}</p>
	{/if}
</div>


