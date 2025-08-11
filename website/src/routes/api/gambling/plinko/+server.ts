import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { randomInt } from 'crypto';
import type { RequestHandler } from './$types';

interface PlinkoRequest {
    risk: 'low' | 'medium' | 'high';
    amount: number;
}

// Define the multipliers for each risk level and row
const PLINKO_MULTIPLIERS = {
    low: [
        [1.2],
        [1.1, 1.3],
        [1.0, 1.2, 1.4],
        [0.9, 1.1, 1.3, 1.5],
        [0.8, 1.0, 1.2, 1.4, 1.6],
        [0.7, 0.9, 1.1, 1.3, 1.5, 1.7],
        [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8],
        [0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9]
    ],
    medium: [
        [1.5],
        [1.2, 1.8],
        [0.9, 1.5, 2.1],
        [0.6, 1.2, 1.8, 2.4],
        [0.3, 0.9, 1.5, 2.1, 2.7],
        [0, 0.6, 1.2, 1.8, 2.4, 3.0],
        [0, 0.3, 0.9, 1.5, 2.1, 2.7, 3.3],
        [0, 0, 0.6, 1.2, 1.8, 2.4, 3.0, 3.6]
    ],
    high: [
        [2.0],
        [1.5, 2.5],
        [1.0, 2.0, 3.0],
        [0.5, 1.5, 2.5, 3.5],
        [0, 1.0, 2.0, 3.0, 4.0],
        [0, 0.5, 1.5, 2.5, 3.5, 4.5],
        [0, 0, 1.0, 2.0, 3.0, 4.0, 5.0],
        [0, 0, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5]
    ]
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

            // Simulate ball drop (8 rows of pegs)
            const path = [];
            let position = 0; // Start in the middle
            path.push(position);
            
            for (let i = 0; i < 7; i++) {
                // 50/50 chance to go left or right at each peg
                position += Math.random() < 0.5 ? 0 : 1;
                path.push(position);
            }

            // Get the final position (0-7)
            const finalPosition = path[path.length - 1];
            
            // Get the multiplier based on risk level and final position
            const multiplier = PLINKO_MULTIPLIERS[risk][7][finalPosition];
            const payout = roundedAmount * multiplier;
            const newBalance = roundedBalance - roundedAmount + payout;

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
                path,
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
