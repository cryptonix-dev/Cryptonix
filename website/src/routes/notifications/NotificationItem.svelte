<script lang="ts">
    interface Notification {
        type: 'HOPIUM' | 'TRANSFER' | 'RUG_PULL' | 'SYSTEM';
        title?: string;
        message?: string;
        link?: string;
        isRead: boolean;
    }

    export let notification: Notification;
    export let isNew = false;

    import { Button } from '$lib/components/ui/button';
    import { goto } from '$app/navigation';

    async function handle(action: 'ACCEPT' | 'DECLINE') {
        try {
            const res = await fetch('/api/friends?status=PENDING');
            if (res.ok) {
                const { friends } = await res.json();
                const username = notification?.message?.match(/@(\w+)/)?.[1];
                const item = friends.find((f: any) => f.requester?.username === username);
                if (item) {
                    await fetch('/api/friends', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, action }) });
                }
            }
            await goto('/messages');
        } catch {}
    }

    function getNotificationColorClasses(type: string, isNew: boolean, isRead: boolean) {
        const base =
            'hover:bg-muted/50 flex w-full items-start gap-4 rounded-md p-3 text-left transition-all duration-200';

        if (isNew) {
            return `${base} bg-primary/10`;
        }

        if (!isRead) {
            const colors = {
                HOPIUM: 'bg-blue-50/50 dark:bg-blue-950/10',
                TRANSFER: 'bg-green-50/50 dark:bg-green-950/10',
                RUG_PULL: 'bg-red-50/50 dark:bg-red-950/10',
                SYSTEM: 'bg-purple-50/50 dark:bg-purple-950/10'
            };
            return `${base} ${colors[type as keyof typeof colors] || 'bg-muted/20'}`;
        }

        return base;
    }
</script>

<div
  class={getNotificationColorClasses(notification.type, isNew, notification.isRead)}
>
  <slot />
  {#if notification.title === 'Friend request'}
    <div class="ml-auto flex items-center gap-2">
      <Button size="sm" onclick={() => handle('ACCEPT')}>Accept</Button>
      <Button size="sm" variant="outline" onclick={() => handle('DECLINE')}>Decline</Button>
    </div>
  {/if}
</div>