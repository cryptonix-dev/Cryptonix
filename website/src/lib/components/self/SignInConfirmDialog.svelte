<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { signIn } from '$lib/auth-client';
	import { page } from '$app/state';

async function onConfirm() {
		await signIn.social({
			provider: 'google',
			callbackURL: `${page.url.pathname}?signIn=1`
		});
	}

async function onDiscord() {
  await signIn.social({
    provider: 'discord',
    callbackURL: `${page.url.pathname}?signIn=1`
  });
}

	let { open = $bindable(false) } = $props<{
		open?: boolean;
	}>();
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Sign in to Cryptonix</DialogTitle>
			<DialogDescription>
				Choose a service to sign in with. Your account will be created automatically if you don't
				have one.
			</DialogDescription>
		</DialogHeader>
		<div class="flex flex-col gap-4 py-2">
			<Button
				class="flex w-full items-center justify-center gap-2"
				variant="outline"
				onclick={() => onConfirm()}
			>
				<img
					class="h-5 w-5"
					src="https://lh3.googleusercontent.com/COxitqgJr1sJnIDe8-jiKhxDx1FrYbtRHKJ9z_hELisAlapwE9LUPh6fcXIfb5vwpbMl4xl9H9TRFPc5NOO8Sb3VSgIBrfRYvW6cUA"
					alt="Google"
				/>
				<span>Continue with Google</span>
			</Button>

  <Button
    class="flex w-full items-center justify-center gap-2"
    variant="outline"
    onclick={() => onDiscord()}
  >
    <img
      class="h-5 w-5"
      src="https://cdn.worldvectorlogo.com/logos/discord-6.svg"
      alt="Discord"
    />
    <span>Continue with Discord</span>
  </Button>

			<p class="text-muted-foreground text-center text-xs">
				By continuing, you agree to our
				<a href="/legal/terms" class="text-primary hover:underline">Terms of Service</a>
				and
				<a href="/legal/privacy" class="text-primary hover:underline">Privacy Policy</a>
			</p>
		</div>
	</DialogContent>
</Dialog>
