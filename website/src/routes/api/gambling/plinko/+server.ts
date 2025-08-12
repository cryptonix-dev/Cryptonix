import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

interface PlinkoRequest {
    risk: 'low' | 'medium' | 'high';
    amount: number;
}

// Final-slot multipliers to MATCH the UI in `Plinko.svelte`
// Board uses 9 columns (COLS = 9). Index 0..8 corresponds to the visible slots.
const SLOT_MULTIPLIERS: Record<'low' | 'medium' | 'high', number[]> = {
    low:    [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8],
    medium: [0.1, 0.3, 0.7, 1.2, 1.7, 2.2, 2.7, 3.2, 3.7],
    high:   [0.0, 0.2, 0.5, 1.0, 1.8, 2.6, 3.4, 4.2, 5.0]
};

export const POST: RequestHandler = async ({ request }) => {
    const session = await auth.api.getSession({
        headers: request.headers
    });

    if (!session?.user) {
        throw error(401, 'Not authenticated');
    }

    try {
        const { risk, amount }: PlinkoRequest = await request.json();

        if (!['low', 'medium', 'high'].includes(risk)) {
            return json({ error: 'Invalid risk level' }, { status: 400 });
        }

        if (!amount || amount <= 0 || !Number.isFinite(amount)) {
            return json({ error: 'Invalid bet amount' }, { status: 400 });
        }

        if (amount > 1000000) {
            return json({ error: 'Bet amount too large' }, { status: 400 });
        }

        const userId = Number(session.user.id);

        const result = await db.transaction(async (tx) => {
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

            // Simulate ball drop on a board with 8 rows of pegs and 9 slots at the bottom
            // Outputs:
            // - uiPath: absolute X positions in range [0..8] for the UI animation
            // - finalSlotIndex: bottom slot index [0..8] used to select multiplier
            const uiPath: number[] = [];
            const COLS = 9; // must match UI
            const ROWS = 8; // peg rows
            let uiX = Math.floor((COLS - 1) / 2); // start centered (4)
            uiPath.push(uiX);

            for (let i = 0; i < ROWS - 1; i++) {
                const goRight = Math.random() >= 0.5;
                uiX += goRight ? 1 : -1;
                uiX = Math.max(0, Math.min(COLS - 1, uiX)); // clamp within board
                uiPath.push(uiX);
            }

            const finalSlotIndex = uiX; // 0..8

            // Multiplier must align with UI
            const multiplier = SLOT_MULTIPLIERS[risk][finalSlotIndex];
            const payout = Math.round((roundedAmount * multiplier) * 100000000) / 100000000;
            const newBalance = Math.round((roundedBalance - roundedAmount + payout) * 100000000) / 100000000;

            // Update user balance
            await tx
                .update(user)
                .set({
                    baseCurrencyBalance: newBalance.toFixed(8),
                    updatedAt: new Date()
                })
                .where(eq(user.id, userId));

            return {
                won: payout > 0,
                path: uiPath,
                multiplier,
                payout,
                amountWagered: roundedAmount,
                newBalance
            };
        });

        return json(result);
    } catch (e) {
        console.error('Plinko API error:', e);
        const errorMessage = e instanceof Error ? e.message : 'Internal server error';
        return json({ error: errorMessage }, { status: 400 });
    }
};
