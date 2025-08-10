<script lang="ts">
  import { onMount } from 'svelte';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { USER_DATA } from '$lib/stores/user-data';
  import { getPublicUrl } from '$lib/utils';
  import SignInConfirmDialog from '$lib/components/self/SignInConfirmDialog.svelte';

  let shouldSignIn = $state(false);

  type Friendship = { id: number; requesterId: number; addresseeId: number; status: 'PENDING' | 'ACCEPTED' | 'BLOCKED', requester?: any, addressee?: any };
  let friends = $state<Friendship[]>([]);
  let requests = $state<Friendship[]>([]);
  // Sending friend requests moved to Messages page

  async function load() {
    const resAccepted = await fetch('/api/friends?status=ACCEPTED');
    if (resAccepted.ok) friends = (await resAccepted.json()).friends as Friendship[];
    const resPending = await fetch('/api/friends?status=PENDING');
    if (resPending.ok) requests = (await resPending.json()).friends as Friendship[];
  }

  // Friend request UI removed from this page

  async function respond(id: number, action: 'ACCEPT' | 'DECLINE' | 'CANCEL' | 'BLOCK') {
    const res = await fetch('/api/friends', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    if (res.ok) await load();
  }

  async function startDmWith(userId: number) {
    const res = await fetch('/api/messages/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toUserId: userId }) });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/messages?conversationId=${data.conversationId}`;
    }
  }

  onMount(() => { if (!$USER_DATA) { shouldSignIn = true; } else { load(); } });

  function isIncoming(r: Friendship): boolean { return $USER_DATA ? r.addresseeId === Number($USER_DATA.id) : false; }
  function otherUser(r: Friendship) { return isIncoming(r) ? r.requester : r.addressee; }
</script>

<SignInConfirmDialog bind:open={shouldSignIn} />

<div class="container mx-auto max-w-4xl p-6">
  <h1 class="mb-4 text-2xl font-bold">Friends</h1>

  {#if !$USER_DATA}
    <p class="text-muted-foreground">Please sign in to manage friends.</p>
  {:else}
    <!-- Friend requests are initiated from the Messages page now -->

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card.Root>
        <Card.Header>
          <Card.Title>Requests</Card.Title>
          <Card.Description>Incoming and outgoing</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-2">
          {#each requests as r}
            <div class="flex items-center justify-between rounded border p-2">
              <div class="flex min-w-0 items-center gap-3">
                {#if otherUser(r)?.image}
                  <img class="h-8 w-8 rounded-full" src={getPublicUrl(otherUser(r).image)} alt="" />
                {:else}
                  <div class="h-8 w-8 rounded-full bg-muted"></div>
                {/if}
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium">{otherUser(r)?.name || otherUser(r)?.username}</div>
                  <div class="text-muted-foreground text-xs">{isIncoming(r) ? 'Incoming' : 'Outgoing'}</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                {#if isIncoming(r)}
                  <Button size="sm" onclick={() => respond(r.id, 'ACCEPT')}>Accept</Button>
                  <Button size="sm" variant="outline" onclick={() => respond(r.id, 'DECLINE')}>Decline</Button>
                {:else}
                  <Button size="sm" variant="outline" onclick={() => respond(r.id, 'CANCEL')}>Cancel</Button>
                {/if}
              </div>
            </div>
          {/each}
          {#if requests.length === 0}
            <p class="text-muted-foreground text-sm">No pending requests</p>
          {/if}
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>Friends</Card.Title>
          <Card.Description>People you are connected with</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-2">
          {#each friends as f}
            <div class="flex items-center justify-between rounded border p-2">
              <div class="flex min-w-0 items-center gap-3">
                {#if otherUser(f)?.image}
                  <img class="h-8 w-8 rounded-full" src={getPublicUrl(otherUser(f).image)} alt="" />
                {:else}
                  <div class="h-8 w-8 rounded-full bg-muted"></div>
                {/if}
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium">{otherUser(f)?.name || otherUser(f)?.username}</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <Badge>ACCEPTED</Badge>
                <Button size="sm" variant="outline" onclick={() => startDmWith(otherUser(f)?.id)}>Message</Button>
                <Button size="sm" variant="ghost" onclick={async () => {
                  if (confirm('Remove friend?')) {
                    await fetch('/api/friends', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: otherUser(f)?.id }) });
                    await load();
                  }
                }}>Unfriend</Button>
              </div>
            </div>
          {/each}
          {#if friends.length === 0}
            <p class="text-muted-foreground text-sm">No friends yet</p>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</div>


