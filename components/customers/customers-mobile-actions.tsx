import { MobileQuickActions } from "@/components/shared/mobile-quick-actions";

export function CustomersMobileActions() {
  return (
    <MobileQuickActions
      actionHref="/customers/new"
      actionLabel="Add customer"
      marker="customers"
    />
  );
}
