<script lang="ts">
	import { getPrestigeColor } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import { Crown, Star, Sparkles, Flame, Snowflake } from 'lucide-svelte';

	interface Props {
		decoration?: string;
		prestigeLevel?: number;
		isAdmin?: boolean;
		size?: 'sm' | 'md' | 'lg';
		children?: Snippet;
	}

	let { decoration, prestigeLevel = 0, isAdmin = false, size = 'md', children } = $props<Props>();

	// Fix hydration mismatch as per Svelte 5 migration guide
	if (typeof window !== 'undefined') {
		// stash the value...
		const initialDecoration = decoration;

		// unset it...
		decoration = undefined;

		$effect(() => {
			// ...and reset after we've mounted
			decoration = initialDecoration;
		});
	}

	// Debug logging
	$effect(() => {
		console.log('AvatarDecoration props changed:', { decoration, prestigeLevel, isAdmin, size });
	});

	function getDecorationStyle() {
		if (isAdmin) {
			return {
				background: 'linear-gradient(45deg, #7a5d00, #ffd700)',
				animation: 'spin 3s linear infinite',
				border: 'none'
			};
		}

		if (prestigeLevel > 0) {
			const color = getPrestigeColor(prestigeLevel);
			return {
				background: `linear-gradient(45deg, ${color}, ${color}dd)`,
				boxShadow: `0 0 10px ${color}40`
			};
		}

		switch (decoration) {
			case 'crown':
				return {
					background: 'linear-gradient(45deg, #7a5d00, #ffd700)',
					boxShadow: '0 0 12px #ffd70066',
					border: 'none'
				};
			case 'star':
				return {
					background: 'linear-gradient(45deg, #7a3a00, #ff9a3c)',
					boxShadow: '0 0 12px #ff9a3c66',
					border: 'none'
				};
			case 'sparkle':
				return {
					background: 'linear-gradient(45deg, #1c6b7a, #4ecdc4)',
					boxShadow: '0 0 12px #4ecdc466',
					border: 'none'
				};
			case 'fire':
				return {
					background: 'linear-gradient(45deg, #7a1f00, #ff6b00, #ffb300)',
					boxShadow: '0 0 12px #ff6b0066',
					animation: 'pulse 2s ease-in-out infinite',
					border: 'none'
				};
			case 'ice':
				return {
					background: 'linear-gradient(45deg, #1b5fa3, #45b7d1)',
					boxShadow: '0 0 12px #45b7d166',
					border: 'none'
				};
			case 'rainbow':
				return {
					background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57, #ff9ff3)',
					animation: 'spin 4s linear infinite',
					border: 'none'
				};
			default:
				return {};
		}
	}

	function getDecorationIconComponent() {
		if (isAdmin) return Crown;
		if (prestigeLevel > 0) return Star;
		
		switch (decoration) {
			case 'crown': return Crown;
			case 'star': return Star;
			case 'sparkle': return Sparkles;
			case 'fire': return Flame;
			case 'ice': return Snowflake;
			case 'rainbow': return Sparkles;
			default: return null;
		}
	}

	function getIconSizeClasses() {
		switch (size) {
			case 'sm':
				return 'w-5 h-5';
			case 'md':
				return 'w-6 h-6';
			case 'lg':
				return 'w-8 h-8';
			default:
				return 'w-6 h-6';
		}
	}

	function getSizeClasses() {
		switch (size) {
			case 'sm': return 'w-6 h-6';
			case 'md': return 'w-8 h-8';
			case 'lg': return 'w-10 h-10';
			default: return 'w-8 h-8';
		}
	}

	function getPositionClasses() {
		switch (size) {
			case 'sm': return '-top-1.5 -right-1.5';
			case 'md': return '-top-2 -right-2';
			case 'lg': return '-top-2.5 -right-2.5';
			default: return '-top-2 -right-2';
		}
	}

	function getFontSizeClasses(): string {
		switch (size) {
			case 'sm':
				return 'text-[12px]';
			case 'md':
				return 'text-[14px]';
			case 'lg':
				return 'text-[18px]';
			default:
				return 'text-[14px]';
		}
	}
</script>

{#if decoration || prestigeLevel > 0 || isAdmin}
	<div class="relative inline-block">
		<div 
			class="absolute {getPositionClasses()} rounded-full flex items-center justify-center leading-none font-semibold {getSizeClasses()} {getFontSizeClasses()} z-10 pointer-events-none"
			style={getDecorationStyle()}
		>
			{#if getDecorationIconComponent()}
				<svelte:component 
					this={getDecorationIconComponent()} 
					class={`${getIconSizeClasses()} font-bold`} 
					style={isAdmin || decoration === 'crown' ? "color:#FFD700; transform: rotate(35deg); fill: #FFD700;" : "color: white; fill: white;"}
				/>
			{/if}
		</div>
		{@render children?.()}
	</div>
{:else}
	{@render children?.()}
{/if}

<style>
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}
</style>
