<script lang="ts">
  import { onMount } from 'svelte';
  
  let { data } = $props<{ data: { id: string } }>();
  const params = { id: data.id };

  let messages = $state<any[]>([]);
  let composing = $state('');
  let loading = $state(false);
  let status = $state<'OPEN' | 'PENDING' | 'SOLVED' | 'CLOSED'>('OPEN');
  let isAdmin = $state(false);
  let subject = $state('');

  async function load() {
    const res = await fetch(`/api/tickets/${params.id}/messages`);
    if (res.ok) {
      const data = await res.json();
      messages = data.messages ?? [];
    }
    // Fetch ticket meta
    const metaRes = await fetch(`/api/tickets/${params.id}`);
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      status = metaData.ticket.status;
      subject = metaData.ticket.subject;
      isAdmin = metaData.isAdmin;
    }
  }

  async function send() {
    if (!composing.trim()) return;
    loading = true;
    try {
      const res = await fetch(`/api/tickets/${params.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: composing })
      });
      if (!res.ok) {
        const txt = await res.text();
        alert('Failed to send: ' + txt);
        return;
      }
      composing = '';
      await load();
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<section class="space-y-4">
  <div class="flex items-center gap-2">
    <h1 class="text-2xl font-bold flex-1">Ticket #{params.id} — {subject}</h1>
    {#if isAdmin}
      <select class="border rounded px-2 py-1 bg-background" bind:value={status} onchange={async () => {
        await fetch(`/api/tickets/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      }}>
        <option value="OPEN">Open</option>
        <option value="PENDING">Pending</option>
        <option value="SOLVED">Solved</option>
        <option value="CLOSED">Closed</option>
      </select>
    {/if}
  </div>

  <div class="space-y-2">
    {#each messages as m}
      <div class={`p-3 rounded border ${m.isStaffReply ? 'bg-muted' : ''}`}>
        <div class="text-xs opacity-70">{new Date(m.createdAt).toLocaleString()} {m.isStaffReply ? '(staff)' : ''}</div>
        <div class="whitespace-pre-wrap">{m.message}</div>
      </div>
    {/each}
  </div>

  <div class="grid gap-2 max-w-xl">
    <textarea class="border rounded px-2 py-1 bg-background" placeholder="Write a reply" bind:value={composing}></textarea>
    <button class="border rounded px-3 py-1" disabled={loading} onclick={send}>Send</button>
  </div>
</section>


