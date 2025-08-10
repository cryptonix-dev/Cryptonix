<script lang="ts">
	import Coinflip from '$lib/components/self/games/Coinflip.svelte';
	import Slots from '$lib/components/self/games/Slots.svelte';
	import Mines from '$lib/components/self/games/Mines.svelte';
	import Dice from '$lib/components/self/games/Dice.svelte';
	import Plinko from '$lib/components/self/games/Plinko.svelte';
	import Crash from '$lib/components/self/games/Crash.svelte';
	import { USER_DATA } from '$lib/stores/user-data';
	import { PORTFOLIO_SUMMARY, fetchPortfolioSummary } from '$lib/stores/portfolio-data';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import SignInConfirmDialog from '$lib/components/self/SignInConfirmDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import SEO from '$lib/components/self/SEO.svelte';

	let shouldSignIn = $state(false);
	let balance = $state(0);
	let loading = $state(true);
	let activeGame = $state('coinflip');

	function handleBalanceUpdate(newBalance: number) {
		balance = newBalance;

		if ($PORTFOLIO_SUMMARY) {
			PORTFOLIO_SUMMARY.update((data) =>
				data
					? {
							...data,
							baseCurrencyBalance: newBalance,
							totalValue: newBalance + data.totalCoinValue
						}
					: null
			);
		}
	}

	$effect(() => {
		if ($USER_DATA && $PORTFOLIO_SUMMARY) {
			balance = $PORTFOLIO_SUMMARY.baseCurrencyBalance;
		}
	});
</script>

<SEO 
	title="Gambling - Cryptonix"
	description="Play virtual gambling games with simulated currency in Cryptonix. Try coinflip, slots, mines, dice, plinko, and crash games using virtual money with no real-world value - purely for entertainment."
	keywords="virtual gambling simulation, coinflip game, slots game, mines game, dice game, plinko game, crash game, virtual casino, simulated gambling, entertainment games"
/>

<SignInConfirmDialog bind:open={shouldSignIn} />

<div class="container mx-auto max-w-4xl p-6">
	<h1 class="mb-6 text-center text-3xl font-bold">Gambling</h1>

	{#if !$USER_DATA}
		<div class="flex h-96 items-center justify-center">
			<div class="text-center">
				<div class="text-muted-foreground mb-4 text-xl">Sign in to start gambling</div>
				<p class="text-muted-foreground mb-4 text-sm">You need an account to gamble away your life savings</p>
				<Button onclick={() => (shouldSignIn = true)}>Sign In</Button>
			</div>
		</div>
	{:else}
		<!-- Game Selection -->
		<div class="mb-6 flex flex-wrap justify-center gap-2">
			<Button
				variant={activeGame === 'coinflip' ? 'default' : 'outline'}
				onclick={() => (activeGame = 'coinflip')}
				class="min-w-[100px]"
			>
				Coinflip
			</Button>
			<Button
				variant={activeGame === 'slots' ? 'default' : 'outline'}
				onclick={() => (activeGame = 'slots')}
				class="min-w-[100px]"
			>
				Slots
			</Button>
			<Button
				variant={activeGame === 'mines' ? 'default' : 'outline'}
				onclick={() => (activeGame = 'mines')}
				class="min-w-[100px]"
			>
				Mines
			</Button>
			<Button
				variant={activeGame === 'dice' ? 'default' : 'outline'}
				onclick={() => (activeGame = 'dice')}
				class="min-w-[100px]"
			>
				Dice
			</Button>
			<Button
				variant={activeGame === 'plinko' ? 'default' : 'outline'}
				onclick={() => (activeGame = 'plinko')}
				class="min-w-[100px]"
			>
				Plinko
			</Button>
			<Button
				variant={activeGame === 'crash' ? 'default' : 'outline'}
				onclick={() => (activeGame = 'crash')}
				class="min-w-[100px]"
			>
				Crash
			</Button>
		</div>

		<!-- Game Content -->
		{#if activeGame === 'coinflip'}
			<Coinflip bind:balance onBalanceUpdate={handleBalanceUpdate} />
		{:else if activeGame === 'slots'}
			<Slots bind:balance onBalanceUpdate={handleBalanceUpdate} />
		{:else if activeGame === 'mines'}
			<Mines bind:balance onBalanceUpdate={handleBalanceUpdate} />
		{:else if activeGame === 'dice'}
			<Dice bind:balance onBalanceUpdate={handleBalanceUpdate} />
		{:else if activeGame === 'plinko'}
			<Plinko bind:balance onBalanceUpdate={handleBalanceUpdate} />
		{:else if activeGame === 'crash'}
			<Crash bind:balance onBalanceUpdate={handleBalanceUpdate} />
		{/if}
	{/if}
</div>
