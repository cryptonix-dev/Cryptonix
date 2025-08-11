<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Slider } from '$lib/components/ui/slider';
	import { Label } from '$lib/components/ui/label';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { volumeSettings } from '$lib/stores/volume-settings';

	const { balance = 0, onBalanceUpdate } = $props<{
		balance?: number;
		onBalanceUpdate?: (newBalance: number) => void;
	}>();

	// Remove the effect that was causing infinite loops
	// We'll update the balance directly when it changes from API responses

	// Game state
	let betAmount = $state(10);
	let autoCashOut = $state(2);
	let gameState = $state<{
		active: boolean;
		crashed: boolean;
		multiplier: number;
		crashPoint: number;
		timeRemaining: number;
		gameId: string | null;
	}>({
		active: false,
		crashed: false,
		multiplier: 1.0,
		crashPoint: 0,
		timeRemaining: 0,
		gameId: null
	});

	let playerState = $state<{
		hasBet: boolean;
		cashedOut: boolean;
		cashOutMultiplier: number;
		payout: number;
	}>({
		hasBet: false,
		cashedOut: false,
		cashOutMultiplier: 0,
		payout: 0
	});

	// Game history
	let history = $state<number[]>([]);

	// Animation state
	let animationFrame: number | null = null;
	let lastUpdateTime = 0;
	const GAME_DURATION = 30000; // 30 seconds
	let gameStartTime = 0;

	// Clean up on unmount
	onMount(() => {
		// Initialize with a few random crash points for the history
		for (let i = 0; i < 10; i++) {
			history.push(generateRandomCrashPoint());
		}

		// Start polling for game state
		pollGameState();

		return () => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
		};
	});

	// Generate a random crash point (for history)
	function generateRandomCrashPoint(): number {
		// Using an exponential distribution that favors lower multipliers
		return Math.max(1, Math.floor(Math.random() * 10) * 0.5 + 1);
	}

	// Format currency
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
	}

	// Format multiplier
	function formatMultiplier(multiplier: number): string {
		return multiplier.toFixed(2) + 'x';
	}

	// Play sound effect
	function playSound(type: 'win' | 'lose' | 'cashout' | 'crash' | 'tick') {
		if ($volumeSettings.muted) return;
		
		const audio = new Audio();
		audio.volume = $volumeSettings.volume / 100;
		
		switch (type) {
			case 'win':
				audio.src = '/sounds/win.mp3';
				break;
			case 'lose':
				audio.src = '/sounds/lose.mp3';
				break;
			case 'cashout':
				audio.src = '/sounds/cashout.mp3';
				break;
			case 'crash':
				audio.src = '/sounds/crash.mp3';
				break;
			case 'tick':
				audio.src = '/sounds/tick.mp3';
				break;
		}
		
		audio.play().catch(e => console.error('Error playing sound:', e));
	}

	// Update game state from server
	async function updateGameState() {
		try {
			const response = await fetch('/api/gambling/crash' + (gameState.gameId ? `?gameId=${gameState.gameId}` : ''));
			const data = await response.json();

			if (data.active !== gameState.active || data.crashed !== gameState.crashed) {
				// Game state changed
				if (data.active && !gameState.active) {
					// New game started
					gameStartTime = Date.now() - (GAME_DURATION - data.timeRemaining);
					playerState = {
						hasBet: false,
						cashedOut: false,
						cashOutMultiplier: 0,
						payout: 0
					};
				} else if (data.crashed && !gameState.crashed) {
					// Game crashed
					if (playerState.hasBet && !playerState.cashedOut) {
						// Player lost their bet
						playerState = {
							...playerState,
							cashedOut: true,
							payout: 0
						};
						playSound('lose');
					}
					
					// Add to history
					history = [data.crashPoint, ...history].slice(0, 10);
					playSound('crash');
				}
			}

			// Update game state
			gameState = {
				...gameState,
				...data,
				multiplier: data.active ? data.currentMultiplier || 1.0 : 1.0
			};

			// Check for auto-cashout
			if (
				gameState.active && 
				playerState.hasBet && 
				!playerState.cashedOut && 
				autoCashOut > 0 && 
				gameState.multiplier >= autoCashOut
			) {
				handleCashOut();
			}

		} catch (error) {
			console.error('Error updating game state:', error);
		}
	}

	// Poll for game state updates
	let pollInterval: number;
	function pollGameState() {
		updateGameState();
		pollInterval = window.setInterval(updateGameState, 1000);
	}

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});

	// Place a bet
	async function placeBet() {
		console.log('placeBet called', { 
			betAmount, 
			balance, 
			hasBet: playerState.hasBet, 
			gameActive: gameState.active 
		});
		
		// Validation checks with detailed error messages
		if (betAmount <= 0) {
			const msg = 'Bet amount must be greater than 0';
			console.error(msg, { betAmount });
			toast.error(msg);
			return;
		}
		
		if (betAmount > balance) {
			const msg = `Insufficient balance. You have ${balance} but tried to bet ${betAmount}`;
			console.error(msg, { betAmount, balance });
			toast.error(msg);
			return;
		}
		
		if (playerState.hasBet) {
			const msg = 'You have already placed a bet for this round';
			console.error(msg);
			toast.error(msg);
			return;
		}

		try {
			console.log('Sending bet request to server...', { amount: betAmount, cashOutAt: autoCashOut });
			const response = await fetch('/api/gambling/crash', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				credentials: 'include', // Include cookies for authentication
				body: JSON.stringify({
					amount: betAmount,
					cashOutAt: autoCashOut > 0 ? autoCashOut : undefined
				})
			});
			
			console.log('Server response status:', response.status);

			if (!response.ok) {
				let errorMessage = `Server error: ${response.status} ${response.statusText}`;
				try {
					const errorData = await response.json();
					errorMessage = errorData.error || errorData.message || errorMessage;
					console.error('Error response from server:', errorData);
				} catch (e) {
					const text = await response.text();
					console.error('Failed to parse error response:', text);
					errorMessage = `Failed to place bet: ${text || response.statusText}`;
				}
				throw new Error(errorMessage);
			}

			const result = await response.json();
			
			// Update local state
			playerState = {
				hasBet: true,
				cashedOut: false,
				cashOutMultiplier: 0,
				payout: 0
			};

			gameState = {
				...gameState,
				gameId: result.gameId
			};

			// Update balance
			if (onBalanceUpdate) {
				onBalanceUpdate(result.newBalance);
			}

		} catch (error) {
			console.error('Bet error:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to place bet');
		}
	}

	// Cash out the current bet
	async function handleCashOut() {
		if (!playerState.hasBet || playerState.cashedOut || !gameState.active) return;

		try {
			const response = await fetch('/api/gambling/crash', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					gameId: gameState.gameId,
					multiplier: gameState.multiplier
				})
			});

			if (!response.ok) {
				const error = await response.json().catch(() => ({}));
				
				if (error.crashed) {
					// Game crashed before we could cash out
					playerState = {
						...playerState,
						cashedOut: true,
						payout: 0
					};
					playSound('lose');
					return;
				}
				
				throw new Error(error.error || 'Failed to cash out');
			}

			const result = await response.json();
			
			// Update player state
			playerState = {
				hasBet: true,
				cashedOut: true,
				cashOutMultiplier: gameState.multiplier,
				payout: result.totalPayout
			};

			// Update balance
			if (onBalanceUpdate) {
				onBalanceUpdate(result.newBalance);
			}

			playSound('cashout');

		} catch (error) {
			console.error('Cash out error:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to cash out');
		}
	}

	// Calculate the current multiplier based on game time
	function calculateMultiplier(elapsed: number): number {
		// This is a simple linear multiplier for now
		// In a real game, you might want a more sophisticated algorithm
		return 1 + (elapsed / 1000) * 0.5;
	}

	// Get the background color based on the multiplier
	function getMultiplierColor(multiplier: number): string {
		if (multiplier < 2) return 'bg-green-500';
		if (multiplier < 5) return 'bg-blue-500';
		if (multiplier < 10) return 'bg-purple-500';
		if (multiplier < 20) return 'bg-yellow-500';
		return 'bg-red-500';
	}
</script>

<div class="crash-container">
	<div class="flex flex-col lg:flex-row gap-6">
		<!-- Game Area -->
		<div class="flex-1">
			<div class="bg-card rounded-lg p-4 mb-4">
				<!-- Multiplier Display -->
				<div class="relative h-64 bg-background rounded-lg mb-4 overflow-hidden">
					<!-- Graph Area -->
					<div class="absolute inset-0 flex items-center justify-center">
						<svg class="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
							<!-- Graph line -->
							<path 
								d="M 0,200 L 400,0" 
								stroke="currentColor" 
								stroke-width="2" 
								stroke-dasharray="5,5" 
								class="text-muted-foreground opacity-50"
							/>
						</svg>
					</div>

					<!-- Current Multiplier -->
					<div class="absolute inset-0 flex flex-col items-center justify-center">
						<div class="text-5xl font-bold mb-2">
							{formatMultiplier(gameState.multiplier)}
						</div>
						<div class="text-sm text-muted-foreground">
							{gameState.active 
								? 'Multiplier is increasing...' 
								: gameState.crashed 
									? `Crashed at ${formatMultiplier(gameState.crashPoint)}` 
									: 'Place your bet!'}
						</div>
					</div>

					<!-- Auto Cash Out Line -->
					{#if autoCashOut > 0 && !playerState.cashedOut}
						<div 
							class="absolute left-0 right-0 border-t-2 border-dashed border-yellow-400"
							style="bottom: {Math.min(100, (autoCashOut - 1) * 10)}%;"
						>
							<div class="absolute right-2 -top-6 text-yellow-400 text-xs">
								Auto: {autoCashOut.toFixed(2)}x
							</div>
						</div>
					{/if}
				</div>

				<!-- Game Controls -->
				<div class="grid grid-cols-2 gap-4">
					<!-- Place Bet Button -->
					<Button
						on:click={() => {
							console.log('Button clicked', { 
								gameActive: gameState.active, 
								hasBet: playerState.hasBet,
								betAmount,
								balance,
								disabled: gameState.active || playerState.hasBet || betAmount <= 0 || betAmount > balance
							});
							placeBet();
						}}
						disabled={
							gameState.active ||  // Disable when game is active (betting period is over)
							playerState.hasBet || 
							betAmount <= 0 || 
							betAmount > balance
						}
						class="h-16 text-lg font-bold"
						variant={!playerState.hasBet ? 'default' : 'outline'}
					>
						{!playerState.hasBet 
							? 'PLACE BET' 
							: 'BET PLACED'}
					</Button>

					<!-- Cash Out Button -->
					<Button
						on:click={handleCashOut}
						disabled={
							!gameState.active || 
							!playerState.hasBet || 
							playerState.cashedOut ||
							gameState.crashed
						}
						class="h-16 text-lg font-bold bg-green-600 hover:bg-green-700"
					>
						{playerState.cashedOut 
							? `CASHED OUT AT ${playerState.cashOutMultiplier.toFixed(2)}x` 
							: 'CASH OUT'}
					</Button>
				</div>

				<!-- Bet Amount -->
				<div class="mt-4">
					<Label for="bet-amount" class="block mb-2">Bet Amount</Label>
					<Input
						id="bet-amount"
						type="number"
						min="0.01"
						step="0.01"
						bind:value={betAmount}
						class="text-right"
						disabled={playerState.hasBet && !playerState.cashedOut}
					/>
				</div>

				<!-- Auto Cash Out -->
				<div class="mt-4">
					<div class="flex justify-between mb-2">
						<Label for="auto-cashout">Auto Cash Out</Label>
						<span class="text-sm font-mono">{autoCashOut.toFixed(2)}x</span>
					</div>
					<Slider
						id="auto-cashout"
						min={1}
						max={10}
						step={0.1}
						value={[autoCashOut]}
						onValueChange={(e) => autoCashOut = e[0]}
						disabled={playerState.hasBet && !playerState.cashedOut}
					/>
					<div class="flex justify-between text-xs text-muted-foreground mt-1">
						<span>1.00x</span>
						<span>10.00x</span>
					</div>
				</div>
			</div>

			<!-- Game Info -->
			<div class="bg-card rounded-lg p-4 mt-4">
				<h3 class="font-semibold mb-2">How to Play</h3>
				<ol class="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
					<li>Place a bet before the round starts</li>
					<li>Watch the multiplier increase from 1.00x</li>
					<li>Cash out before the game crashes to win</li>
					<li>If you don't cash out in time, you lose your bet</li>
				</ol>
			</div>
		</div>

		<!-- Game History & Stats -->
		<div class="w-full lg:w-64 flex-shrink-0">
			<div class="bg-card rounded-lg p-4 mb-4">
				<h3 class="font-semibold mb-2">History</h3>
				<div class="flex flex-wrap gap-2">
					{#each history as point, i}
						<div 
							class="w-10 h-8 rounded flex items-center justify-center text-xs font-mono
								{point < 2 ? 'bg-green-500' : 
								 point < 5 ? 'bg-blue-500' : 
								 point < 10 ? 'bg-purple-500' : 
								 'bg-red-500'}"
						>
						{point.toFixed(1)}x
					</div>
					{/each}
				</div>
			</div>

			<!-- Next Round Timer -->
			{#if !gameState.active}
				<div class="bg-card rounded-lg p-4">
					<h3 class="font-semibold mb-2">Next Round</h3>
					<div class="text-2xl font-mono text-center">
						{Math.ceil(gameState.timeRemaining / 1000)}s
					</div>
				</div>
			{/if}

			<!-- Player Stats -->
			<div class="bg-card rounded-lg p-4 mt-4">
				<h3 class="font-semibold mb-2">Your Stats</h3>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Current Bet:</span>
						<span>{playerState.hasBet ? formatCurrency(betAmount) : '-'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Potential Win:</span>
						<span>
							{playerState.hasBet && !playerState.cashedOut 
								? formatCurrency(betAmount * gameState.multiplier * 0.99) 
								: playerState.cashedOut 
									? formatCurrency(playerState.payout)
									: '-'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Balance:</span>
						<span>{formatCurrency(balance)}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.crash-container {
		max-width: 1200px;
		margin: 0 auto;
	}

	/* Animation for the multiplier */
	@keyframes pulse {
		0% { transform: scale(1); }
		50% { transform: scale(1.05); }
		100% { transform: scale(1); }
	}

	/* Style for the cash out button when multiplier is high */
	button:disabled[disabled] {
		opacity: 0.7;
	}

	/* Style for the graph area */
	.graph-line {
		transition: all 0.1s ease-out;
	}
</style>
