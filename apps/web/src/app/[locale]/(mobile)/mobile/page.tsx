import { useTranslations } from 'next-intl';
import { MessageSquare, BarChart3, Bell } from 'lucide-react';

export default function MobilePage() {
  return (
    <div className="container mx-auto max-w-md p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Mobile Admin</h1>
        <p className="text-muted-foreground">
          Access your conversations, analytics, and notifications on the go
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Inbox</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            View and manage customer conversations
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Analytics</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Track key metrics and performance
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Notifications</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Stay updated with push notifications
          </p>
        </div>
      </div>
    </div>
  );
}
