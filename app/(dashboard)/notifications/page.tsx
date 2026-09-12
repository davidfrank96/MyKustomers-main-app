import { WorkspacePage } from "@/components/layout/workspace-page";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationListView } from "@/components/notifications/notification-center";
export default function NotificationsPage() {
  return (
    <WorkspacePage className="max-w-3xl">
      <section>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Updates across your businesses.
        </p>
      </section>
      <Card>
        <CardContent className="pt-4">
          <NotificationListView />
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}
