<script lang="ts">
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
  } from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { signIn, signOut } from '$lib/auth-client';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getPublicUrl } from '$lib/utils';

  type Provider = 'google' | 'discord';
  type StoredAccount = { id: number; name: string; username: string; image?: string | null; provider?: Provider };
  const STORAGE_KEY = 'cx_accounts';

  let { open = $bindable(false) } = $props<{ open?: boolean }>();
  let accounts: StoredAccount[] = $state([]);
  let choosingForId: number | null = $state(null);

  function loadAccounts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      accounts = raw ? (JSON.parse(raw) as StoredAccount[]) : [];
    } catch {}
  }
  function saveAccounts() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts.slice(0, 5))); } catch {}
  }
  function removeAccount(id: number) {
    accounts = accounts.filter(a => a.id !== id);
    saveAccounts();
  }
  onMount(loadAccounts);

  async function switchWith(provider: Provider) {
    try {
      await signOut();
    } catch (e) {
      // ignore, proceed to sign-in
    }
    await signIn.social({ provider, callbackURL: `${page.url.pathname}?switch=1` });
  }

  async function switchToAccount(acc: StoredAccount) {
    const provider = acc.provider || 'google';
    await switchWith(provider);
  }
</script>

<Dialog bind:open>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Switch account</DialogTitle>
      <DialogDescription>
        Choose one of your saved accounts or add another. We'll sign you out first, then redirect.
      </DialogDescription>
    </DialogHeader>
    <div class="flex flex-col gap-4 py-2">
      {#if accounts.length > 0}
        <div class="space-y-2">
          {#each accounts as acc}
            <div class="flex items-center justify-between gap-3 rounded border p-2">
              <div class="flex min-w-0 items-center gap-3">
                {#if acc.image}
                  <img class="h-8 w-8 rounded-full" src={getPublicUrl(acc.image)} alt="" />
                {:else}
                  <div class="h-8 w-8 rounded-full bg-muted"></div>
                {/if}
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium">{acc.name}</div>
                  <div class="text-muted-foreground truncate text-xs">@{acc.username}</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                {#if acc.provider}
                  <span class="text-muted-foreground text-xs capitalize">{acc.provider}</span>
                {/if}
                <Button size="sm" onclick={() => switchToAccount(acc)}>Switch</Button>
                <Button size="sm" variant="ghost" onclick={() => removeAccount(acc.id)}>Remove</Button>
              </div>
            </div>
            {#if choosingForId === acc.id}
              <div class="flex items-center justify-end gap-2 pr-2">
                <Button size="sm" variant="outline" onclick={() => switchWith('google')}>Google</Button>
                <Button size="sm" variant="outline" onclick={() => switchWith('discord')}>Discord</Button>
              </div>
            {/if}
          {/each}
        </div>
      {/if}

      <div class="space-y-2">
        <div class="text-muted-foreground text-xs">Add another account</div>
        <div class="flex gap-2">
          <Button class="flex-1" variant="outline" onclick={() => switchWith('google')}>Google</Button>
          <Button class="flex-1" variant="outline" onclick={() => switchWith('discord')}>Discord</Button>
        </div>
      </div>
    </div>
  </DialogContent>
  </Dialog>


