import type { ReactNode } from "react";

type AppFrameProps = {
  children: ReactNode;
};

export function AppFrame({ children }: AppFrameProps) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
