<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Slider } from '$lib/components/ui/slider';
	import { Label } from '$lib/components/ui/label';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { volumeSettings } from '$lib/stores/volume-settings';

	const { balance = 0, onBalanceUpdate } = $props<{
		balance?: number;
		onBalanceUpdate?: (newBalance: number) => void;
	}>();

	// Create reactive state for balance that can be updated
	$effect(() => {
		if (onBalanceUpdate) {
			onBalanceUpdate($state.snapshot(balance));
		}
	});

	// Game state
	let betAmount = $state(10);
	let riskLevel = $state<'low' | 'medium' | 'high'>('medium');
	let isDropping = $state(false);
	let gameResult = $state<{
		won: boolean;
		path: number[];
		multiplier: number;
		payout: number;
	} | null>(null);

	// Animation state
	let animationFrame: number | null = null;
	let dropStartTime = 0;
	const DROP_DURATION = 3000; // 3 seconds for the ball to drop

	// Peg board configuration
	const ROWS = 8;
	const COLS = 9; // ROWS + 1

	// Multiplier slots based on risk level
	const SLOT_MULTIPLIERS = {
		low: [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8],
		medium: [0.1, 0.3, 0.7, 1.2, 1.7, 2.2, 2.7, 3.2, 3.7],
		high: [0, 0.2, 0.5, 1.0, 1.8, 2.6, 3.4, 4.2, 5.0]
	};

	// Calculate the current multipliers based on risk level
	// Removed the effect since it was causing an infinite loop
	// The riskLevel is already reactive and will update the UI when changed

	// Clean up animation frame on component unmount
	onMount(() => {
		return () => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
		};
	});

	// Handle bet amount change
	function handleBetChange(e: Event) {
		const value = parseFloat((e.target as HTMLInputElement).value);
		if (!isNaN(value) && value >= 0) {
			betAmount = Math.min(value, 1000000); // Max bet 1M
		}
	}

	// Quick bet helpers
	let lastBetAmount = $state<number | null>(null);

	function clampBet(value: number): number {
		if (!Number.isFinite(value)) return betAmount;
		return Math.max(0.01, Math.min(value, Math.min(1000000, balance)));
	}

	function setMinBet() {
		betAmount = 0.01;
	}

	function setMaxBet() {
		betAmount = clampBet(balance);
	}

	function doubleBet() {
		betAmount = clampBet(betAmount * 2);
	}

	function halveBet() {
		betAmount = clampBet(betAmount / 2);
	}

	function repeatLastBet() {
		if (lastBetAmount) betAmount = clampBet(lastBetAmount);
	}

	// Handle risk level change
	function setRiskLevel(level: 'low' | 'medium' | 'high') {
		riskLevel = level;
	}

	// Animate the ball drop
	function animateBall(currentTime: number) {
		if (!gameResult) {
			isDropping = false;
			return;
		}

		if (!dropStartTime) {
			dropStartTime = currentTime;
		}

		const elapsed = currentTime - dropStartTime;
		const progress = Math.min(elapsed / DROP_DURATION, 1);

		// Calculate current position based on path and progress
		const path = gameResult.path;
		const totalSegments = path.length - 1;
		const segmentProgress = progress * totalSegments;
		const currentSegment = Math.min(Math.floor(segmentProgress), totalSegments - 1);
		const segmentProgressRatio = segmentProgress - currentSegment;

		// Calculate position between current and next point
		const currentX = path[currentSegment];
		const nextX = path[Math.min(currentSegment + 1, path.length - 1)];
		const xPos = currentX + (nextX - currentX) * segmentProgressRatio;
		const yPos = currentSegment + segmentProgressRatio;

		// Update ball position
		const ball = document.getElementById('plinko-ball');
		if (ball) {
			const cellSize = 40; // Should match CSS
			const ballSize = 20; // Should match CSS

			ball.style.left = `calc(${(xPos / (COLS - 1)) * 100}% - ${ballSize / 2}px)`;
			ball.style.top = `calc(${(yPos / ROWS) * 100}% - ${ballSize / 2}px)`;
		}

		if (progress < 1) {
			animationFrame = requestAnimationFrame(animateBall);
		} else {
			// Animation complete
			animationFrame = null;
			isDropping = false;
			
			// Play win/lose sound
			if (gameResult.won) {
				playSound('win');
			} else {
				playSound('lose');
			}
		}
	}

	// Play sound effect
    function playSound(type: 'win' | 'lose' | 'drop') {
		if ($volumeSettings.muted) return;
		
		const audio = new Audio();
		audio.volume = $volumeSettings.volume / 100;
		
		switch (type) {
			case 'win':
                audio.src = '/sound/win.mp3';
				break;
			case 'lose':
                audio.src = '/sound/lose.mp3';
				break;
			case 'drop':
                // Fallback to click sound (no dedicated drop asset)
                audio.src = '/sound/click.mp3';
				break;
		}
			audio.play().catch(e => console.error('Error playing sound:', e));
	}

	// Handle the Plinko drop
	async function handleDrop() {
		if (isDropping || betAmount <= 0 || betAmount > balance) return;

		isDropping = true;
		gameResult = null;

		try {
			const response = await fetch('/api/gambling/plinko', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					risk: riskLevel,
					amount: betAmount
				})
			});

			if (!response.ok) {
				const error = await response.json().catch(() => ({}));
				throw new Error(error.error || 'Failed to place bet');
			}

			const result = await response.json();
			gameResult = result;
			lastBetAmount = betAmount;

			// Update balance
			if (onBalanceUpdate) {
				onBalanceUpdate(result.newBalance);
			}

			// Start animation
			dropStartTime = performance.now();
			animationFrame = requestAnimationFrame(animateBall);

			// Play drop sound
			playSound('drop');

		} catch (error) {
			console.error('Plinko error:', error);
			toast.error(error instanceof Error ? error.message : 'An error occurred');
			isDropping = false;
		}
	}

	// Calculate if a cell should have a peg
	function hasPeg(row: number, col: number): boolean {
		// Create a centered triangular peg layout
		if (row >= ROWS - 1) return false;
		const mid = Math.floor((COLS - 1) / 2);
		const minCol = Math.max(0, mid - row);
		const maxCol = Math.min(COLS - 1, mid + row);
		if (col < minCol || col > maxCol) return false;
		return ((col - minCol) % 2) === 0;
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
</script>

<div class="plinko-container">
	<div class="flex flex-col md:flex-row gap-6">
		<!-- Game Board -->
		<div class="flex-1">
			<div class="bg-card rounded-lg p-4 mb-4">
				<div class="relative h-[400px] w-full bg-background rounded-lg overflow-hidden">
					<!-- Peg Board -->
					<div class="absolute inset-0 grid grid-cols-{COLS} grid-rows-{ROWS} gap-2 p-4" style="--cols: {COLS}; --rows: {ROWS};">
						{#each Array(ROWS) as _, row}
							{#each Array(COLS) as _, col}
								<div class="relative flex items-center justify-center">
									{#if hasPeg(row, col)}
										<div class="w-2 h-2 rounded-full bg-primary"></div>
									{/if}
								</div>
							{/each}
						{/each}
					</div>

					<!-- Ball (positioned absolutely) -->
					{#if isDropping || gameResult}
						<div
							id="plinko-ball"
							class="absolute w-5 h-5 rounded-full bg-primary z-10 transition-all duration-300 ease-out"
							style="transform: translate(-50%, -50%);"
						></div>
					{/if}

					<!-- Multiplier Slots -->
					<div class="absolute bottom-0 left-0 right-0 flex justify-between px-2">
						{#each SLOT_MULTIPLIERS[riskLevel] as multiplier, i}
							<div class="text-center text-xs font-mono px-1">
								<div class="h-2 w-full border-l border-r border-b border-border"></div>
								<div class="mt-1">{multiplier}x</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Game Result -->
			{#if gameResult}
				<div class="bg-card rounded-lg p-4 mb-4">
					<div class="text-center">
						{#if gameResult.won}
							<div class="text-green-500 text-lg font-bold">
								Won {formatCurrency(gameResult.payout)} ({gameResult.multiplier.toFixed(2)}x)!
							</div>
						{:else}
							<div class="text-red-500 text-lg font-bold">
								Lost {formatCurrency(gameResult.amountWagered)}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Controls -->
		<div class="w-full md:w-80 flex-shrink-0">
			<div class="bg-card rounded-lg p-4 mb-4">
				<h3 class="text-lg font-semibold mb-4">Plinko</h3>

				<!-- Bet Amount -->
				<div class="mb-4">
					<Label for="bet-amount" class="block mb-2">Bet Amount</Label>
					<Input
						id="bet-amount"
						type="number"
						min="0.01"
						step="0.01"
						bind:value={betAmount}
						on:input={handleBetChange}
						class="text-right"
						disabled={isDropping}
					/>
					<div class="mt-2 grid grid-cols-5 gap-2">
						<Button size="sm" variant="outline" on:click={halveBet} disabled={isDropping}>÷2</Button>
						<Button size="sm" variant="outline" on:click={doubleBet} disabled={isDropping}>x2</Button>
						<Button size="sm" variant="outline" on:click={setMinBet} disabled={isDropping}>Min</Button>
						<Button size="sm" variant="outline" on:click={setMaxBet} disabled={isDropping}>Max</Button>
						<Button size="sm" on:click={repeatLastBet} disabled={isDropping || lastBetAmount === null}>Repeat</Button>
					</div>
				</div>

				<!-- Risk Level -->
				<div class="mb-6">
					<Label class="block mb-2">Risk Level</Label>
					<div class="flex gap-2 w-full">
						<Button 
							on:click={() => setRiskLevel('low')} 
							variant={riskLevel === 'low' ? 'default' : 'outline'}
							disabled={isDropping}
							class="flex-1"
						>
							Low
						</Button>
						<Button 
							on:click={() => setRiskLevel('medium')} 
							variant={riskLevel === 'medium' ? 'default' : 'outline'}
							disabled={isDropping}
							class="flex-1"
						>
							Medium
						</Button>
						<Button 
							on:click={() => setRiskLevel('high')} 
							variant={riskLevel === 'high' ? 'default' : 'outline'}
							disabled={isDropping}
							class="flex-1"
						>
							High
						</Button>
					</div>
					<div class="mt-2 text-xs text-muted-foreground">
						{#if riskLevel === 'low'}Lower risk, lower rewards{/if}
						{#if riskLevel === 'medium'}Balanced risk and rewards{/if}
						{#if riskLevel === 'high'}Higher risk, higher rewards{/if}
					</div>
				</div>

				<!-- Multipliers -->
				<div class="mb-6">
					<Label class="block mb-2">Multipliers</Label>
					<div class="grid grid-cols-3 gap-2 text-center text-xs">
						<div class="font-medium">Low Risk</div>
						<div class="font-medium">Med Risk</div>
						<div class="font-medium">High Risk</div>
						
						{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as i}
							<div class="py-1">{SLOT_MULTIPLIERS.low[i]}x</div>
							<div class="py-1">{SLOT_MULTIPLIERS.medium[i]}x</div>
							<div class="py-1">{SLOT_MULTIPLIERS.high[i]}x</div>
						{/each}
					</div>
				</div>

				<!-- Drop Button -->
				<Button
					on:click={handleDrop}
					disabled={isDropping || betAmount <= 0 || betAmount > balance}
					class="w-full py-6 text-lg font-bold"
				>
					{isDropping ? 'Dropping...' : 'DROP'}
				</Button>

				<!-- Balance -->
				<div class="mt-4 text-center text-sm">
					<div>Balance: {formatCurrency(balance)}</div>
					{#if betAmount > balance}
						<div class="text-red-500 text-xs mt-1">Insufficient balance</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.plinko-container {
		max-width: 1200px;
		margin: 0 auto;
	}

	/* Animation for the ball drop */
	@keyframes drop {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(400px);
		}
	}

	/* Responsive grid for the peg board */
	.grid-cols-\{COLS\} {
		display: grid;
		grid-template-columns: repeat(var(--cols, 9), 1fr);
	}

	.grid-rows-\{ROWS\} {
		display: grid;
		grid-template-rows: repeat(var(--rows, 8), 1fr);
	}
</style>
