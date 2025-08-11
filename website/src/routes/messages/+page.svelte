<script lang="ts">
  import { onMount } from 'svelte';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { USER_DATA } from '$lib/stores/user-data';
  import SignInConfirmDialog from '$lib/components/self/SignInConfirmDialog.svelte';
  import { DM_UNREAD, DM_LAST, DM_TYPING } from '$lib/stores/websocket';
  import { getPublicUrl } from '$lib/utils';
  import { UserPlus, UserMinus } from 'lucide-svelte';

  let shouldSignIn = $state(false);
  type Thread = { id: number; isGroup: boolean; createdAt: string, otherUser?: { id: number; username: string; name: string; image: string }, lastContent?: string, lastCreatedAt?: string, unreadCount?: number };
  type Msg = { id: number; senderId: number; content: string; createdAt: string };
  let threads = $state<Thread[]>([]);
  let activeId = $state<number | null>(null);
  let messages = $state<Msg[]>([]);
  let content = $state('');
  let activeThread = $derived(threads.find(t => t.id === activeId) || null);
  let scrollEl = $state<HTMLDivElement | null>(null);
  let profileOpen = $state(false);
  let profileData = $state<any>(null);
  let friendStatus = $state<'NONE' | 'PENDING' | 'ACCEPTED'>('NONE');
  let friendBusy = $state(false);
  const profileCache: Record<number, { data: any; until: number }> = {};

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function senderName(senderId: number): string {
    if ($USER_DATA && senderId === Number($USER_DATA.id)) return $USER_DATA.name || 'You';
    return activeThread?.otherUser?.name || activeThread?.otherUser?.username || 'User';
  }
  function senderAvatar(senderId: number): string | null {
    if ($USER_DATA && senderId === Number($USER_DATA.id)) return $USER_DATA.image || null;
    return activeThread?.otherUser?.image || null;
  }

  async function openProfile(userId: number) {
    profileOpen = true;
    profileData = null;
    const now = Date.now();
    if (profileCache[userId]?.until > now) {
      profileData = profileCache[userId].data;
    } else {
      const res = await fetch(`/api/user/${userId}`);
      if (res.ok) {
        profileData = await res.json();
        profileCache[userId] = { data: profileData, until: now + 60_000 }; // 1 minute cache
      }
    }
    checkFriendStatus(userId).catch(() => {});
  }

  async function checkFriendStatus(userId: number) {
    friendStatus = 'NONE';
    const [accRes, penRes] = await Promise.all([
      fetch('/api/friends?status=ACCEPTED'),
      fetch('/api/friends?status=PENDING')
    ]);
    const meId = Number($USER_DATA?.id);
    if (accRes.ok) {
      const { friends } = await accRes.json();
      if (friends.some((f: any) => f.requesterId === userId || f.addresseeId === userId)) friendStatus = 'ACCEPTED';
    }
    if (friendStatus !== 'ACCEPTED' && penRes.ok) {
      const { friends } = await penRes.json();
      if (friends.some((f: any) => f.requesterId === userId || f.addresseeId === userId)) friendStatus = 'PENDING';
    }
  }

  async function addFriend(usernameParam?: string) {
    const targetUsername = usernameParam || activeThread?.otherUser?.username || profileData?.profile?.username;
    if (!targetUsername) return;
    friendBusy = true;
    try {
      const res = await fetch('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: targetUsername }) });
      if (res.ok) {
        friendStatus = 'PENDING';
      }
    } finally {
      friendBusy = false;
    }
  }

  async function unfriend(userId: number) {
    friendBusy = true;
    try {
      await fetch('/api/friends', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
      friendStatus = 'NONE';
    } finally { friendBusy = false; }
  }

  async function startDMTo(userId: number) {
    const res = await fetch('/api/messages/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toUserId: userId }) });
    if (res.ok) {
      const { conversationId } = await res.json();
      profileOpen = false;
      await loadThreads();
      activeId = Number(conversationId);
      await loadMessages();
    }
  }

  // Start New Message dialog state
  type FriendRow = { id: number; status: string; requesterId: number; addresseeId: number; requester: { id: number; username: string; name: string; image: string }, addressee: { id: number; username: string; name: string; image: string } };
  type FriendUser = { id: number; username: string; name: string; image: string };
  let startOpen = $state(false);
  let friendSearch = $state('');
  let friends = $state<FriendRow[]>([]);
  let filteredFriends = $derived(
    friends.filter(f => {
      const meIdLocal = Number($USER_DATA?.id);
      const other = f.requesterId === meIdLocal ? f.addressee : f.requester;
      const q = friendSearch.toLowerCase();
      return (other.name || other.username || '').toLowerCase().includes(q);
    })
  );
  let usernameStart = $state('');
  let startError = $state('');

  function getOther(f: FriendRow): FriendUser {
    const meIdLocal = Number($USER_DATA?.id);
    return f.requesterId === meIdLocal ? f.addressee : f.requester;
  }
  async function startDmWithFriend(f: FriendRow) {
    const other = getOther(f);
    const res = await fetch('/api/messages/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toUserId: other.id }) });
    if (res.ok) {
      const { conversationId } = await res.json();
      startOpen = false;
      await loadThreads();
      activeId = Number(conversationId);
      await loadMessages();
    }
  }

  async function startDmByUsername() {
    startError = '';
    const username = usernameStart.trim();
    if (!username) return;
    const res = await fetch(`/api/user/${encodeURIComponent(username)}`);
    if (!res.ok) { startError = 'User not found'; return; }
    const data = await res.json();
    const userId = data?.profile?.id;
    if (!userId) { startError = 'User not found'; return; }
    const r = await fetch('/api/messages/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toUserId: userId }) });
    if (r.ok) {
      const { conversationId } = await r.json();
      // Also send a friend request implicitly
      await addFriend(username);
      startOpen = false;
      usernameStart = '';
      await loadThreads();
      activeId = Number(conversationId);
      await loadMessages();
    }
  }

  async function loadThreads() {
    const res = await fetch('/api/messages?enriched=1');
    if (res.ok) {
      threads = (await res.json()).conversations as Thread[];
      // initialize unread store from server counts (non-authoritative; WS will keep live)
      DM_UNREAD.update(m => {
        const copy = { ...m } as Record<number, number>;
        for (const t of threads) {
          if (typeof t.unreadCount === 'number') copy[t.id] = t.unreadCount;
        }
        return copy;
      });
    }
  }
  async function loadFriends() {
    const res = await fetch('/api/friends?status=ACCEPTED');
    if (res.ok) friends = (await res.json()).friends as FriendRow[];
  }
  async function loadMessages() {
    if (!activeId) return;
    const res = await fetch(`/api/messages?conversationId=${activeId}`);
    if (res.ok) messages = (await res.json()).messages as Msg[];
    // Mark as read client-side and notify server
    DM_UNREAD.update(m => { const n = { ...m }; if (activeId!) delete n[activeId!]; return n; });
    await fetch('/api/messages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: activeId }) });
    queueMicrotask(() => { scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' }); });
  }
  let typingTimer: any = null;
  function handleTyping() {
    if (!activeId) return;
    // fire typing ping (debounced)
    window.clearTimeout(typingTimer);
    fetch('/api/messages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: activeId, typing: true }) }).catch(()=>{});
    typingTimer = setTimeout(() => {}, 1000);
  }
  async function send() {
    if (!content.trim()) return;
    const payload: any = activeId ? { conversationId: activeId, content } : { content };
    if (!payload.conversationId) {
      const toUserId = Number(prompt('Enter recipient user id (once only to create thread):'));
      if (!toUserId) return;
      payload.toUserId = toUserId;
    }
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { content = ''; await loadMessages(); }
  }

  let confirmCloseOpen = $state(false);
  let confirmCloseId: number | null = $state(null);
  function requestCloseDM(t: Thread) {
    confirmCloseId = t.id;
    confirmCloseOpen = true;
  }
  async function performCloseDM() {
    if (!confirmCloseId) return;
    const res = await fetch('/api/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: confirmCloseId }) });
    if (res.ok) {
      threads = threads.filter(x => x.id !== confirmCloseId);
      if (activeId === confirmCloseId) { activeId = null; messages = []; }
    }
    confirmCloseOpen = false;
    confirmCloseId = null;
  }

  async function removeFriend(t: Thread) {
    if (!t.otherUser?.id) return;
    if (!confirm('Remove friend?')) return;
    const res = await fetch('/api/friends', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: t.otherUser.id }) });
    if (res.ok) {
      // Optionally also close DM
    }
  }

  onMount(async () => {
    if (!$USER_DATA) { shouldSignIn = true; return; }
    const url = new URL(window.location.href);
    const cid = url.searchParams.get('conversationId');
    await loadThreads();
    await loadFriends();
    if (cid) { activeId = Number(cid); await loadMessages(); }
  });

  $effect(() => {
    const id = activeThread?.otherUser?.id;
    if (id) checkFriendStatus(id).catch(() => {});
  });
</script>

<SignInConfirmDialog bind:open={shouldSignIn} />

<div class="container mx-auto max-w-6xl p-6">
  <div class="mb-4 flex items-center justify-between">
    <h1 class="text-2xl font-bold">Messages</h1>
    <Button onclick={() => { startOpen = true; }}>New Message</Button>
  </div>

  {#if !$USER_DATA}
    <p class="text-muted-foreground">Please sign in to view messages.</p>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card.Root class="md:col-span-1">
        <Card.Header><Card.Title>Conversations</Card.Title></Card.Header>
        <Card.Content class="space-y-2">
          {#each threads as t}
            <div class={`group w-full rounded-md border p-2 transition hover:bg-muted ${activeId === t.id ? 'bg-muted' : ''}`}>
              <div class="flex items-center gap-3">
                <button class="flex min-w-0 flex-1 items-center gap-3 text-left" onclick={() => { activeId = t.id; loadMessages(); }}>
                  {#if t.otherUser?.image}
                    <img class="h-9 w-9 shrink-0 rounded-full" src={getPublicUrl(t.otherUser.image)} alt="" />
                  {:else}
                    <div class="h-9 w-9 shrink-0 rounded-full bg-muted/70"></div>
                  {/if}
                  <div class="min-w-0">
                    <div class="truncate font-medium">{t.otherUser?.name || t.otherUser?.username || (t.isGroup ? 'Group' : 'Direct')}</div>
                    <div class="text-muted-foreground truncate text-xs">{t.lastContent || $DM_LAST[t.id]?.content || 'No messages yet'}</div>
                  </div>
                </button>
                {#if $DM_UNREAD[t.id]}
                  <span class="bg-primary text-primary-foreground ml-2 rounded px-2 py-0.5 text-xs">{$DM_UNREAD[t.id]}</span>
                {/if}
                <div class="opacity-0 transition group-hover:opacity-100">
                  <button class="rounded px-2 py-1 text-xs hover:bg-muted" title="Close DM" onclick={() => requestCloseDM(t)}>✕</button>
                </div>
              </div>
            </div>
          {/each}
          {#if threads.length === 0}
            <p class="text-muted-foreground text-sm">No conversations</p>
          {/if}
        </Card.Content>
      </Card.Root>

      <Card.Root class="md:col-span-2">
        <Card.Header>
      <Card.Title class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          {#if activeThread?.otherUser?.image}
            <img class="h-6 w-6 rounded-full" src={getPublicUrl(activeThread.otherUser.image)} alt={activeThread.otherUser.name || activeThread.otherUser.username} />
          {/if}
          <span>{activeThread?.otherUser?.name || activeThread?.otherUser?.username || 'Chat'}</span>
        </div>
        {#if activeThread?.otherUser?.id}
          {#if friendStatus === 'ACCEPTED'}
            <Button size="sm" variant="outline" title="Unfriend" onclick={() => unfriend(activeThread!.otherUser!.id)} disabled={friendBusy}>
              <UserMinus class="mr-1 h-4 w-4" /> Unfriend
            </Button>
          {:else if friendStatus === 'PENDING'}
            <Button size="sm" variant="secondary" disabled title="Friend request pending">Pending</Button>
          {:else}
            <Button size="sm" title="Add friend" onclick={() => addFriend()} disabled={friendBusy || !activeThread?.otherUser?.username}>
              <UserPlus class="mr-1 h-4 w-4" /> Add friend
            </Button>
          {/if}
        {/if}
      </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-3">
          <div bind:this={scrollEl} class="min-h-[300px] max-h-[60vh] space-y-3 overflow-y-auto rounded border p-3">
            {#each messages as m}
              <div class="flex items-start gap-3">
                <button class="shrink-0" onclick={() => openProfile(m.senderId)}>
                  {#if senderAvatar(m.senderId)}
                    <img class="h-8 w-8 rounded-full" src={getPublicUrl(senderAvatar(m.senderId)!)} alt="" />
                  {:else}
                    <div class="h-8 w-8 rounded-full bg-muted"></div>
                  {/if}
                </button>
                <div class="min-w-0">
                  <div class="flex items-baseline gap-2">
                    <span class="font-semibold">{senderName(m.senderId)}</span>
                    <span class="text-muted-foreground text-xs">{formatTime(m.createdAt)}</span>
                  </div>
                  <div class="text-sm leading-relaxed">{m.content}</div>
                </div>
              </div>
            {/each}
            {#if messages.length === 0}
              <p class="text-muted-foreground text-sm">Select a conversation</p>
            {/if}
            {#if activeId && $DM_TYPING[activeId] && $DM_TYPING[activeId] > Date.now()}
              <div class="text-muted-foreground text-xs">Typing…</div>
            {/if}
          </div>
          <div class="flex gap-2">
            <Input placeholder={activeId ? 'Type a message' : 'Select a conversation'} bind:value={content} disabled={!activeId} oninput={handleTyping} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <Button onclick={send} disabled={!activeId || !content.trim()}>Send</Button>
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</div>

<Dialog.Root bind:open={profileOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Title>Profile</Dialog.Title>
    {#if !profileData}
      <div class="text-muted-foreground text-sm">Loading...</div>
    {:else}
      <div class="mt-2 flex items-center gap-3">
        {#if profileData.profile.image}
          <img class="h-12 w-12 rounded-full" src={getPublicUrl(profileData.profile.image)} alt="" />
        {:else}
          <div class="h-12 w-12 rounded-full bg-muted"></div>
        {/if}
        <div>
          <div class="font-medium">{profileData.profile.name}</div>
          <div class="text-muted-foreground text-sm">@{profileData.profile.username}</div>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div class="rounded border p-2">
          <div class="text-muted-foreground text-xs">Balance</div>
          <div class="font-semibold">${profileData.profile.baseCurrencyBalance?.toLocaleString?.() ?? profileData.profile.baseCurrencyBalance}</div>
        </div>
        <div class="rounded border p-2">
          <div class="text-muted-foreground text-xs">Portfolio</div>
          <div class="font-semibold">${profileData.stats.totalPortfolioValue?.toLocaleString?.() ?? profileData.stats.totalPortfolioValue}</div>
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        {#if friendStatus === 'ACCEPTED'}
          <Button onclick={() => startDMTo(profileData.profile.id)}>Message</Button>
        {:else if friendStatus === 'PENDING'}
          <Button variant="secondary" disabled>Request sent</Button>
          <Button onclick={() => startDMTo(profileData.profile.id)} variant="outline">Message</Button>
        {:else}
          <Button onclick={() => addFriend()} disabled={friendBusy}>Add Friend</Button>
          <Button onclick={() => startDMTo(profileData.profile.id)} variant="outline">Message</Button>
        {/if}
      </div>
      <div class="mt-4">
        <a class="text-primary hover:underline" href={`/user/${profileData.profile.username}`}>View full profile →</a>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={startOpen}>
  <Dialog.Content class="max-w-lg">
    <Dialog.Title>Start a new message</Dialog.Title>
    <div class="mt-3 space-y-3">
      <Input placeholder="Search friends..." bind:value={friendSearch} />
      <div class="max-h-80 space-y-2 overflow-y-auto pr-1">
        {#each filteredFriends as f}
          {#key f.id}
            <button class="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-muted" onclick={() => startDmWithFriend(f)}>
              {#if getOther(f).image}
                <img class="h-9 w-9 rounded-full" src={getPublicUrl(getOther(f).image)} alt="" />
              {:else}
                <div class="h-9 w-9 rounded-full bg-muted"></div>
              {/if}
              <div class="min-w-0">
                <div class="truncate font-medium">{getOther(f).name || getOther(f).username}</div>
                <div class="text-muted-foreground truncate text-xs">@{getOther(f).username}</div>
              </div>
            </button>
          {/key}
        {/each}
        {#if filteredFriends.length === 0}
          <div class="text-muted-foreground text-sm">No friends found.</div>
        {/if}
      </div>
      <div class="mt-3 space-y-2 border-t pt-3">
        <div class="text-xs text-muted-foreground">Start DM by username</div>
        <div class="flex gap-2">
          <Input placeholder="@username" bind:value={usernameStart} />
          <Button onclick={startDmByUsername} disabled={!usernameStart.trim()}>Start</Button>
        </div>
        {#if startError}
          <div class="text-red-500 text-xs">{startError}</div>
        {/if}
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={confirmCloseOpen}>
  <Dialog.Content class="max-w-sm">
    <Dialog.Title>Close conversation</Dialog.Title>
    <p class="text-muted-foreground mt-2 text-sm">This will delete the DM thread for both participants.</p>
    <div class="mt-4 flex justify-end gap-2">
      <Button variant="outline" onclick={() => { confirmCloseOpen = false; confirmCloseId = null; }}>Cancel</Button>
      <Button variant="destructive" onclick={performCloseDM}>Close</Button>
    </div>
  </Dialog.Content>
</Dialog.Root>


