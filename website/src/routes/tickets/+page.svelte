<script lang="ts">
  import { onMount } from 'svelte';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { toast } from 'svelte-sonner';

  let loading = false;
  let tickets: any[] = [];
  let search = '';
  let statusFilter: 'all' | 'OPEN' | 'PENDING' | 'SOLVED' | 'CLOSED' = 'all';
  let page = 1;
  let hasMore = true;
  let subject = '';
  let message = '';
  let priority: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

  async function loadTickets(reset = true) {
    if (reset) {
      page = 1;
      tickets = [];
    }
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('page', String(page));
    params.set('limit', '20');
    const res = await fetch(`/api/tickets?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const newItems = data.tickets ?? [];
      tickets = reset ? newItems : [...tickets, ...newItems];
      hasMore = newItems.length === 20;
    }
  }

  function badgeVariantForStatus(s: string): 'default' | 'success' | 'destructive' | 'secondary' {
    if (s === 'OPEN') return 'secondary';
    if (s === 'PENDING') return 'default';
    if (s === 'SOLVED') return 'success';
    return 'destructive';
  }

  async function createTicket() {
    loading = true;
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, priority })
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error('Failed to create ticket', { description: txt });
        return;
      }
      subject = '';
      message = '';
      await loadTickets();
      toast.success('Ticket created');
    } finally {
      loading = false;
    }
  }

  onMount(() => loadTickets(true));
</script>

<section class="space-y-6">
  <h1 class="text-2xl font-bold">Support Tickets</h1>

  <Card.Root class="max-w-2xl">
    <Card.Header>
      <Card.Title>Create a ticket</Card.Title>
      <Card.Description>Describe your problem and we’ll get back to you.</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-2">
      <Input placeholder="Subject" bind:value={subject} />
      <Textarea placeholder="Describe your issue" rows={5} bind:value={message} />
      <div class="flex gap-2 items-center">
        <label for="priority">Priority:</label>
        <select id="priority" bind:value={priority} class="border rounded px-2 py-1 bg-background">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <Button disabled={loading} onclick={createTicket}>Create Ticket</Button>
      </div>
    </Card.Content>
  </Card.Root>

  <div class="flex items-center gap-2 mt-4">
    <Input class="max-w-sm" placeholder="Search" bind:value={search} oninput={() => loadTickets(true)} />
    <select class="border rounded px-2 py-1 bg-background" bind:value={statusFilter} onchange={() => loadTickets(true)}>
      <option value="all">All</option>
      <option value="OPEN">Open</option>
      <option value="PENDING">Pending</option>
      <option value="SOLVED">Solved</option>
      <option value="CLOSED">Closed</option>
    </select>
  </div>

  <div class="space-y-3">
    {#each tickets as t}
      <a class="block rounded border hover:bg-muted" href={`/tickets/${t.id}`}>
        <Card.Root class="p-3">
          <div class="flex items-center justify-between gap-2">
            <div class="font-medium truncate">{t.subject}</div>
            <div class="flex items-center gap-2">
              <Badge variant={badgeVariantForStatus(t.status)}>{t.status}</Badge>
              <Badge variant="outline" class="text-xs">{t.priority}</Badge>
            </div>
          </div>
          <div class="text-xs opacity-70 mt-1">Updated: {new Date(t.lastActivityAt).toLocaleString()}</div>
        </Card.Root>
      </a>
    {/each}
    {#if hasMore}
      <Button variant="outline" onclick={() => { page += 1; loadTickets(false); }}>Load more</Button>
    {/if}
  </div>
</section>


