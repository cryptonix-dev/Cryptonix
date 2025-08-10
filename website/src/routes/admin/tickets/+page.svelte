<script lang="ts">
  import { onMount } from 'svelte';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';

  let search = '';
  let status: 'all' | 'OPEN' | 'PENDING' | 'SOLVED' | 'CLOSED' = 'all';
  let page = 1;
  let rows: Array<any> = [];
  let hasMore = true;

  async function load(reset = true) {
    if (reset) { page = 1; rows = []; }
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    const res = await fetch(`/api/tickets?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const newItems = data.tickets ?? [];
      rows = reset ? newItems : [...rows, ...newItems];
      hasMore = newItems.length === 20;
    }
  }

  async function updateStatus(id: number, newStatus: string) {
    await fetch(`/api/tickets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    await load(true);
  }

  function badgeVariantForStatus(s: string): 'default' | 'success' | 'destructive' | 'secondary' {
    if (s === 'OPEN') return 'secondary';
    if (s === 'PENDING') return 'default';
    if (s === 'SOLVED') return 'success';
    return 'destructive';
  }

  onMount(() => load(true));
</script>

<div class="container mx-auto max-w-6xl p-6">
  <div class="mb-3">
    <Button variant="outline" onclick={() => (window.location.href = '/admin')}>← Back to Admin</Button>
  </div>
  <h1 class="mb-4 text-2xl font-bold">Ticket Management</h1>

  <div class="mb-4 flex items-center gap-2">
    <Input class="max-w-sm" placeholder="Search tickets" bind:value={search} oninput={() => load(true)} />
    <select class="border rounded px-2 py-1 bg-background" bind:value={status} onchange={() => load(true)}>
      <option value="all">All</option>
      <option value="OPEN">Open</option>
      <option value="PENDING">Pending</option>
      <option value="SOLVED">Solved</option>
      <option value="CLOSED">Closed</option>
    </select>
  </div>

  <div class="space-y-3">
    {#each rows as t}
      <Card.Root class="p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="font-medium truncate">{t.subject}</div>
            <div class="text-xs opacity-70">#{t.id} • {new Date(t.lastActivityAt).toLocaleString()}</div>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant={badgeVariantForStatus(t.status)}>{t.status}</Badge>
            <select class="border rounded px-2 py-1 bg-background" onchange={(e) => updateStatus(t.id, (e.target as HTMLSelectElement).value)}>
              <option value="OPEN">Open</option>
              <option value="PENDING">Pending</option>
              <option value="SOLVED">Solved</option>
              <option value="CLOSED">Closed</option>
            </select>
            <Button variant="outline" onclick={() => location.href = `/tickets/${t.id}`}>Open</Button>
          </div>
        </div>
      </Card.Root>
    {/each}
    {#if hasMore}
      <Button variant="outline" onclick={() => { page += 1; load(false); }}>Load more</Button>
    {/if}
  </div>
</div>


