<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import {
		BookOpen,
		Github,
		Youtube,
		Twitter,
		User,
		Coins,
		TrendingUp,
		Shield
	} from 'lucide-svelte';
	import UserManualModal from '$lib/components/self/UserManualModal.svelte';

	let showUserManual = $state(false);
	function handleManual() {
		showUserManual = !showUserManual;
	}
</script>

<UserManualModal bind:open={showUserManual} />

<svelte:head>
	<title>About - Cryptonix</title>
	<meta
		name="description"
		content="Learn about Cryptonix - a realistic cryptocurrency trading simulation focusing on DeFi risks and mechanics."
	/>
</svelte:head>

<div class="container mx-auto space-y-8 px-4 py-8">
	<div class="space-y-4 text-center">
        <div class="mb-4 flex items-center justify-center gap-2">
            <img src="/facedev/Cryptonix.png" class="h-12 w-12" alt="Cryptonix" />
			<h1 class="text-4xl font-bold">Cryptonix</h1>
		</div>
		<p class="text-muted-foreground mx-auto max-w-2xl text-lg">
			A crypto trading simulator where you can practice trading without losing real money. Create
			coins, trade them, and rug pull!
		</p>
		<div class="flex flex-wrap justify-center gap-4">
			<Button onclick={handleManual} size="lg">
				<BookOpen class="h-4 w-4" />
				User Manual
			</Button>
		</div>
	</div>

	<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Coins class="text-primary h-5 w-5" />
					About Cryptonix
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-3">
					<p class="text-muted-foreground text-sm">
						Cryptonix is a realistic cryptocurrency trading simulation that focuses on DeFi
						(Decentralized Finance) mechanics and the inherent risks of decentralized trading.
					</p>
					<p class="text-muted-foreground text-sm">
						Practice trading strategies, create your own coins, and learn about market dynamics
						without any real financial risk. Experience AMM trading, liquidity pools, and even rug
						pulls. (duh) Some features wont work at the moment. The domain is wrong right now since we dont have a domain for this project "yet"
					</p>
					<p class="text-muted-foreground text-sm">
						Join the community of degenerates where paranoia is profitable!
					</p>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<TrendingUp class="text-primary h-5 w-5" />
					Features
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-2">
					<div class="flex items-center gap-2 text-sm">
						<span>🪙</span>
						<span>Create coins</span>
					</div>
					<div class="flex items-center gap-2 text-sm">
						<span>🟢</span>
						<span>Buy coins</span>
					</div>
					<div class="flex items-center gap-2 text-sm">
						<span>🔴</span>
						<span>Sell coins</span>
					</div>
					<div class="flex items-center gap-2 text-sm">
						<span>⚖️</span>
						<span>Bet on questions (similar to Polymarket)</span>
					</div>
					<div class="flex items-center gap-2 text-sm">
						<span>🎲</span>
						<span>Gamble it all</span>
					</div>
					<div class="flex items-center gap-2 text-sm">
						<span>📊</span>
						<span>View a Treemap graph of the entire market</span>
					</div>
					<div class="flex items-center gap-2 text-sm">
						<span>🏆</span>
						<span>Compete on leaderboards</span>
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<User class="text-primary h-5 w-5" />
					Credits
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					<p class="text-muted-foreground text-sm">Created by <strong>the Cryptonix team.</strong></p>
					<div class="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							href="https://youtube.com/"
							target="_blank"
							rel="noopener"
						>
							<Youtube class="h-4 w-4" />
							YouTube
						</Button>
						<Button
							variant="outline"
							size="sm"
							href="https://x.com/"
							target="_blank"
							rel="noopener"
						>
							<Twitter class="h-4 w-4" />
							Twitter
						</Button>
						<Button
							variant="outline"
							size="sm"
							href="https://github.com/cryptonix-dev"
							target="_blank"
							rel="noopener"
						>
							<Github class="h-4 w-4" />
							GitHub
						</Button>
						<Button
							variant="outline"
							size="sm"
							href="https://discord.gg/"
							target="_blank"
							rel="noopener"
						>
							<Shield class="h-4 w-4" />
							Discord
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
