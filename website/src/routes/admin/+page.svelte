<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { goto } from '$app/navigation';
  let { data } = $props<{ data: { counts: { open: number; pending: number; solved: number; closed: number }, recent: Array<{ id: number; subject: string; status: string; priority: string; lastActivityAt: string }> } }>();
</script>

<div class="container mx-auto max-w-5xl p-6">
  <h1 class="mb-6 text-2xl font-bold">Admin Dashboard</h1>

  <!-- Stats row -->
  <div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
    <Card.Root class="cursor-pointer hover:bg-muted" onclick={() => goto('/admin/tickets?status=OPEN')}>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs">Open</div>
        <div class="text-2xl font-bold">{data.counts.open}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="cursor-pointer hover:bg-muted" onclick={() => goto('/admin/tickets?status=PENDING')}>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs">Pending</div>
        <div class="text-2xl font-bold">{data.counts.pending}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="cursor-pointer hover:bg-muted" onclick={() => goto('/admin/tickets?status=SOLVED')}>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs">Solved</div>
        <div class="text-2xl font-bold">{data.counts.solved}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="cursor-pointer hover:bg-muted" onclick={() => goto('/admin/tickets?status=CLOSED')}>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs">Closed</div>
        <div class="text-2xl font-bold">{data.counts.closed}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Header>
        <Card.Title>Users</Card.Title>
        <Card.Description>Manage users, bans, and roles.</Card.Description>
      </Card.Header>
      <Card.Content>
        <Button onclick={() => goto('/admin/users')}>Open User Management</Button>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Promo Codes</Card.Title>
        <Card.Description>Create and manage promotional codes.</Card.Description>
      </Card.Header>
      <Card.Content>
        <Button onclick={() => goto('/admin/promo')}>Open Promo Codes</Button>
      </Card.Content>
    </Card.Root>

    <Card.Root class="md:col-span-2">
      <Card.Header>
        <Card.Title>Recent Tickets</Card.Title>
        <Card.Description>Latest activity</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-2">
        {#each data.recent as t}
          <a class="block rounded border p-3 hover:bg-muted" href={`/tickets/${t.id}`}>
            <div class="flex items-center justify-between">
              <div class="font-medium truncate">{t.subject}</div>
              <div class="flex items-center gap-2">
                <Badge>{t.status}</Badge>
                <Badge variant="outline" class="text-xs">{t.priority}</Badge>
              </div>
            </div>
            <div class="text-xs opacity-70">{new Date(t.lastActivityAt).toLocaleString()}</div>
          </a>
        {/each}
        <div class="pt-2 flex justify-end">
          <Button variant="outline" onclick={() => goto('/admin/tickets')}>Open Ticket Manager</Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>


