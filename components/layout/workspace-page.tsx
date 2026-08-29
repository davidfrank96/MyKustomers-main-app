import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function WorkspacePage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-8 sm:py-7 lg:px-10",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function WorkspacePageHeader({
  title,
  description,
  eyebrow,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 items-start justify-between gap-3 sm:gap-5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="mb-2 hidden sm:block">{eyebrow}</div>
        ) : null}
        <h1 className="break-words text-[1.625rem] font-semibold leading-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-muted-foreground sm:mt-2 sm:leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
    </section>
  );
}

export function WorkspaceSectionHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-6 sm:text-xl">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
