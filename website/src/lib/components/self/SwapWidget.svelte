<script lang="ts">
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Label } from '$lib/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '$lib/components/ui/select'
	import { toast } from 'svelte-sonner'
	import { onMount } from 'svelte'

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
	let slippageBps = $state<number>(100)
	let isQuoting = $state(false)
	let isSwapping = $state(false)
	let quote: QuoteResponse['quote'] | null = $state(null)

	onMount(() => {
		if (symbols.length >= 2) {
			fromSymbol = symbols[0]
			toSymbol = symbols[1]
		}
	})

	async function fetchQuote() {
		if (!fromAmount || fromAmount <= 0) return
		isQuoting = true
		quote = null
		try {
			const res = await fetch('/api/swap', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fromSymbol, toSymbol, fromAmount, slippageBps, quoteOnly: true })
			})
			if (!res.ok) throw new Error(await res.text())
			const data = (await res.json()) as QuoteResponse
			quote = data.quote
		} catch (e) {
			toast.error('Failed to fetch quote')
		} finally {
			isQuoting = false
		}
	}

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
</script>

<div class="space-y-4">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
			<Input id="amount" type="number" min="0" step="any" bind:value={fromAmount} on:input={fetchQuote} />
		</div>
		<div class="space-y-2">
        <Label for="slippage">Slippage (%)</Label>
            <Input id="slippage" type="number" min="0" step="0.1" value={(slippageBps/100).toString()} on:input={(e) => { const v = Number((e.currentTarget as HTMLInputElement).value); slippageBps = Math.max(0, Math.round((isFinite(v) ? v : 0) * 100)); fetchQuote() }} />
		</div>
	</div>

	<div class="flex items-center gap-2">
		<Button type="button" variant="secondary" onclick={handleFlip} aria-label="Flip" tabindex="0">Flip</Button>
		<Button type="button" onclick={handleSwap} disabled={isSwapping || !fromAmount || fromAmount <= 0} aria-label="Swap" tabindex="0">{isSwapping ? 'Swapping…' : 'Swap'}</Button>
	</div>

	{#if isQuoting}
		<p class="text-sm text-muted-foreground">Getting quote…</p>
	{:else if quote}
		<div class="rounded-md border p-3 text-sm">
			<div class="flex justify-between"><span>Estimated Output</span><span class="font-medium">{quote.coinsOut.toFixed(6)} {toSymbol}</span></div>
			<div class="flex justify-between"><span>Minimum Received</span><span>{quote.minCoinsOut.toFixed(6)} {toSymbol}</span></div>
			<div class="flex justify-between"><span>Intermediary (Base)</span><span>{quote.baseOut.toFixed(6)}</span></div>
			<div class="flex justify-between"><span>Price Impact</span><span>{quote.priceImpactFrom.toFixed(2)}% → {quote.priceImpactTo.toFixed(2)}%</span></div>
		</div>
	{/if}
</div>


