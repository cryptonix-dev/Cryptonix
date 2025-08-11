import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

interface CrashBetRequest {
    amount: number;
    cashOutAt?: number; // Optional: If provided, this is an auto-cashout
}

interface CrashCashOutRequest {
    gameId: string;
    multiplier: number;
}

// In-memory store for active games (in a real app, use Redis or similar for distributed systems)
const activeGames = new Map<string, { startTime: number; crashPoint: number; bets: Map<string, { userId: number; amount: number; cashedOutAt?: number }> }>();

// House edge (1%)
const HOUSE_EDGE = 0.99;

// Generate a crash point using an exponential distribution
function generateCrashPoint(): number {
    // Using a simple algorithm that favors lower multipliers
    // This can be adjusted based on desired distribution
    const r = Math.random();
    // This formula gives a 50% chance of crashing before 1.5x, 75% before 3x, etc.
    const crashPoint = Math.max(1, Math.floor((1 / (1 - r) - 1) / 3 + 1) * 0.1);
    return parseFloat(crashPoint.toFixed(2));
}

// Start a new crash game round
export const POST: RequestHandler = async ({ request }) => {
    const session = await auth.api.getSession({
        headers: request.headers
    });

    if (!session?.user) {
        throw error(401, 'Not authenticated');
    }

    try {
        const { amount, cashOutAt }: CrashBetRequest = await request.json();
        const userId = Number(session.user.id);

        if (!amount || amount <= 0 || !Number.isFinite(amount)) {
            return json({ error: 'Invalid bet amount' }, { status: 400 });
        }

        if (amount > 1000000) {
            return json({ error: 'Bet amount too large' }, { status: 400 });
        }

        if (cashOutAt && (cashOutAt < 1.1 || cashOutAt > 100)) {
            return json({ error: 'Cash out multiplier must be between 1.1x and 100x' }, { status: 400 });
        }

        const result = await db.transaction(async (tx) => {
            // Check user balance
            const [userData] = await tx
                .select({ baseCurrencyBalance: user.baseCurrencyBalance })
                .from(user)
                .where(eq(user.id, userId))
                .for('update')
                .limit(1);

            const currentBalance = Number(userData.baseCurrencyBalance);
            const roundedAmount = Math.round(amount * 100000000) / 100000000;
            const roundedBalance = Math.round(currentBalance * 100000000) / 100000000;

            if (roundedAmount > roundedBalance) {
                throw new Error(`Insufficient funds. You need *${roundedAmount.toFixed(2)} but only have *${roundedBalance.toFixed(2)}`);
            }

            // Find or create active game
            let game = Array.from(activeGames.entries())
                .find(([_, game]) => game && Date.now() - game.startTime < 30000); // 30s game window

            let gameId: string;
            let crashPoint: number;
            
            if (!game) {
                // Start a new game
                gameId = Date.now().toString();
                crashPoint = generateCrashPoint();
                activeGames.set(gameId, {
                    startTime: Date.now(),
                    crashPoint,
                    bets: new Map()
                });
            } else {
                [gameId, { crashPoint }] = game;
            }

            const gameState = activeGames.get(gameId)!;
            
            // Add bet to the game
            gameState.bets.set(`${userId}-${Date.now()}`, {
                userId,
                amount: roundedAmount,
                cashedOutAt: cashOutAt
            });

            // Deduct bet amount from user balance
            const newBalance = roundedBalance - roundedAmount;
            
            await tx
                .update(user)
                .set({
                    baseCurrencyBalance: newBalance.toFixed(8),
                    updatedAt: new Date()
                })
                .where(eq(user.id, userId));

            return {
                gameId,
                betAmount: roundedAmount,
                newBalance,
                cashOutAt,
                message: cashOutAt ? `Bet placed with auto-cashout at ${cashOutAt}x` : 'Bet placed'
            };
        });

        return json(result);
    } catch (e) {
        console.error('Crash game API error:', e);
        const errorMessage = e instanceof Error ? e.message : 'Internal server error';
        return json({ error: errorMessage }, { status: 400 });
    }
};

// Cash out from an active game
export const PUT: RequestHandler = async ({ request }) => {
    const session = await auth.api.getSession({
        headers: request.headers
    });

    if (!session?.user) {
        throw error(401, 'Not authenticated');
    }

    try {
        const { gameId, multiplier }: CrashCashOutRequest = await request.json();
        const userId = Number(session.user.id);

        if (!gameId || !activeGames.has(gameId)) {
            return json({ error: 'Invalid or expired game' }, { status: 400 });
        }

        if (!multiplier || multiplier < 1) {
            return json({ error: 'Invalid multiplier' }, { status: 400 });
        }

        const game = activeGames.get(gameId)!;
        
        // Check if game has already crashed
        if (multiplier >= game.crashPoint) {
            return json({ 
                error: 'Game already crashed',
                crashed: true,
                crashPoint: game.crashPoint
            });
        }

        // Find user's active bets in this game
        let totalPayout = 0;
        const userBets = Array.from(game.bets.entries())
            .filter(([key, bet]) => key.startsWith(`${userId}-`) && !bet.cashedOutAt);

        if (userBets.length === 0) {
            return json({ error: 'No active bets found' }, { status: 400 });
        }

        const result = await db.transaction(async (tx) => {
            // Get current user balance
            const [userData] = await tx
                .select({ baseCurrencyBalance: user.baseCurrencyBalance })
                .from(user)
                .where(eq(user.id, userId))
                .for('update')
                .limit(1);

            const currentBalance = Number(userData.baseCurrencyBalance);

            // Calculate payout for each bet
            for (const [key, bet] of userBets) {
                const payout = bet.amount * multiplier * HOUSE_EDGE;
                totalPayout += payout;
                
                // Mark bet as cashed out
                game.bets.set(key, { ...bet, cashedOutAt: multiplier });
            }

            // Update user balance
            const newBalance = currentBalance + totalPayout;
            
            await tx
                .update(user)
                .set({
                    baseCurrencyBalance: newBalance.toFixed(8),
                    updatedAt: new Date()
                })
                .where(eq(user.id, userId));

            return {
                success: true,
                multiplier,
                totalPayout,
                newBalance,
                message: `Successfully cashed out at ${multiplier.toFixed(2)}x`
            };
        });

        return json(result);
    } catch (e) {
        console.error('Crash cash-out error:', e);
        const errorMessage = e instanceof Error ? e.message : 'Internal server error';
        return json({ error: errorMessage }, { status: 400 });
    }
};

// Get current game state
export const GET: RequestHandler = async ({ url }) => {
    const gameId = url.searchParams.get('gameId');
    
    if (!gameId || !activeGames.has(gameId)) {
        return json({ 
            active: false,
            message: 'No active game found'
        });
    }

    const game = activeGames.get(gameId)!;
    const now = Date.now();
    const elapsed = now - game.startTime;
    const gameTime = 30000; // 30 seconds
    const timeRemaining = Math.max(0, gameTime - elapsed);
    
    // If game is over, clean up
    if (timeRemaining <= 0) {
        activeGames.delete(gameId);
        return json({
            active: false,
            crashed: true,
            crashPoint: game.crashPoint,
            message: 'Game has ended'
        });
    }

    // Calculate current multiplier (in a real game, this would be based on elapsed time)
    // For simplicity, we'll use a linear scale here
    const maxMultiplier = 100; // Cap at 100x
    const currentMultiplier = Math.min(maxMultiplier, (elapsed / 1000) * 2 + 1);
    
    // Check if game should crash
    if (currentMultiplier >= game.crashPoint) {
        activeGames.delete(gameId);
        return json({
            active: false,
            crashed: true,
            crashPoint: game.crashPoint,
            message: 'Game crashed!'
        });
    }

    return json({
        active: true,
        gameId,
        startTime: game.startTime,
        timeRemaining,
        currentMultiplier: parseFloat(currentMultiplier.toFixed(2)),
        crashPoint: game.crashPoint,
        totalBets: game.bets.size,
        message: 'Game in progress'
    });
};
