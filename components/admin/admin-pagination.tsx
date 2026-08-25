import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function pageHref(basePath: string, page: number, q: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (q) params.set("q", q);
  return `${basePath}?${params.toString()}` as Route;
}

export function AdminPagination({
  basePath,
  page,
  q,
  total,
  totalPages,
}: {
  basePath: string;
  page: number;
  q: string;
  total: number;
  totalPages: number;
}) {
  return (
    <nav
      aria-label="Directory pagination"
      className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}, {total.toLocaleString("en")} results
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={pageHref(basePath, page - 1, q)} aria-label="Previous page">
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled aria-label="Previous page">
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={pageHref(basePath, page + 1, q)} aria-label="Next page">
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled aria-label="Next page">
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </nav>
  );
}
