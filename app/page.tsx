import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Home,
  LockKeyhole,
  Mail,
  MessageCircle,
  Rocket,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { AppFrame } from "@/components/layout/app-frame";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: {
    absolute:
      "My Kustomers — Customers, Bookings, Confirmations & Insights for Small Businesses",
  },
  description:
    "My Kustomers helps small businesses manage customers, bookings, confirmations, deliveries and services, private feedback, and business insights in one professional workspace.",
};

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const features: Array<{
  title: string;
  description: string;
  icon: IconComponent;
}> = [
  {
    title: "Customers",
    description: "Keep every customer in one organized place.",
    icon: Users,
  },
  {
    title: "Bookings",
    description: "Create, manage and update bookings easily.",
    icon: CalendarDays,
  },
  {
    title: "Confirmations",
    description: "Send email confirmations automatically.",
    icon: Mail,
  },
  {
    title: "Private feedback",
    description: "Collect feedback privately and respond fast.",
    icon: MessageCircle,
  },
  {
    title: "Insights",
    description: "Understand what's working and grow with confidence.",
    icon: BarChart3,
  },
];

const workflow: Array<{
  title: string;
  description: string;
  icon: IconComponent;
}> = [
  {
    title: "Create booking",
    description: "Add customer details, date, time, and job information.",
    icon: CalendarDays,
  },
  {
    title: "Send confirmation",
    description: "Automatic email confirmation keeps your customers informed.",
    icon: Mail,
  },
  {
    title: "Fulfil or deliver",
    description: "Manage jobs, deliveries or services and keep things moving.",
    icon: Truck,
  },
  {
    title: "Collect feedback & get insights",
    description: "Private feedback and insights help you improve and grow.",
    icon: MessageCircle,
  },
];

const businessTypes: Array<{
  title: string;
  description: string;
  icon: IconComponent;
}> = [
  {
    title: "Book jobs and appointments",
    description: "Manage customer bookings, schedules and reschedules in one place.",
    icon: CalendarDays,
  },
  {
    title: "Manage deliveries",
    description:
      "Track orders, delivery status, and keep customers updated automatically.",
    icon: Truck,
  },
  {
    title: "Provide professional services",
    description: "Deliver great experiences and collect feedback that helps you grow.",
    icon: BriefcaseBusiness,
  },
];

const previewRows: Array<{
  title: string;
  description: string;
  status?: string;
  statusClass?: string;
  icon: IconComponent;
  iconClass?: string;
}> = [
  {
    title: "New booking",
    description: "Emma L. · 2 May, 10:00 AM",
    status: "Confirmed",
    statusClass: "bg-[#e8f4e9] text-[#286437]",
    icon: CalendarDays,
  },
  {
    title: "Email confirmation",
    description: "Booking #BK-1421",
    status: "Sent",
    statusClass: "bg-[#e5f2fb] text-[#145da0]",
    icon: Mail,
  },
  {
    title: "New feedback",
    description: "Private response received",
    status: "5 ★",
    statusClass: "bg-[#f1e8ff] text-[#7436be]",
    icon: MessageCircle,
    iconClass: "text-[#7436be]",
  },
  {
    title: "Out for delivery",
    description: "Order #OR-558 · Today, 2:00 PM",
    status: "In progress",
    statusClass: "bg-[#fff2df] text-[#9a4d08]",
    icon: Truck,
  },
  {
    title: "Weekly insights",
    description: "Bookings up 18% vs last week",
    icon: BarChart3,
  },
];

function Brand() {
  return (
    <Link
      href="/"
      className="flex min-w-0 items-center gap-3"
      aria-label="My Kustomers home"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
        MK
      </span>
      <span className="truncate text-lg font-semibold">My Kustomers</span>
    </Link>
  );
}

function TrustItem({ icon: Icon, children }: { icon: IconComponent; children: string }) {
  return (
    <span className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden={true} />
      <span>{children}</span>
    </span>
  );
}

function ProductPreview() {
  const sidebarIcons = [Home, CalendarDays, Mail, MessageCircle, BarChart3, Settings];

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_6px_18px_rgba(23,33,29,0.07)]"
      aria-label="Illustrative My Kustomers workspace preview"
    >
      <div className="flex min-h-[22rem] sm:min-h-[25rem] lg:min-h-[27rem]">
        <div className="flex w-11 shrink-0 flex-col items-center gap-3 border-r border-border bg-[#fbfcfa] py-3 sm:w-14 sm:gap-4 sm:py-4">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-[0.625rem] font-semibold text-white">
            MK
          </span>
          {sidebarIcons.map((Icon, index) => (
            <span
              key={index}
              className={
                index === 0
                  ? "grid size-8 place-items-center rounded-md bg-primary text-white"
                  : "grid size-8 place-items-center text-muted-foreground"
              }
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 p-2.5 sm:p-4">
          <div className="mb-3 flex min-w-0 items-start justify-between gap-2 sm:mb-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold sm:text-base">
                Good morning, Acme Services <span aria-hidden="true">👋</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {"Here's what's happening today."}
              </p>
            </div>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-primary/5 px-2 py-1 text-[0.6875rem] font-medium text-primary min-[360px]:inline-flex">
              <span className="size-1.5 rounded-full bg-[#2ca25f]" aria-hidden="true" />3
              new
            </span>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            {previewRows.map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.title}
                  className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-card p-2 shadow-[0_1px_3px_rgba(23,33,29,0.04)] sm:gap-3 sm:p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary sm:size-10">
                    <Icon
                      className={`size-[1.125rem] sm:size-5 ${row.iconClass ?? ""}`}
                      aria-hidden={true}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{row.title}</p>
                    <p className="truncate text-xs text-muted-foreground sm:text-sm">
                      {row.description}
                    </p>
                  </div>
                  {row.status ? (
                    <span
                      className={`hidden shrink-0 rounded-md px-2 py-1 text-[0.625rem] font-medium min-[360px]:inline-flex sm:text-xs ${row.statusClass}`}
                    >
                      {row.status}
                    </span>
                  ) : (
                    <svg
                      viewBox="0 0 72 32"
                      className="hidden h-7 w-14 shrink-0 text-[#1f7a45] min-[360px]:block sm:w-16"
                      role="img"
                      aria-label="Bookings increased"
                    >
                      <polyline
                        points="2,25 14,17 24,21 36,10 48,15 58,4 70,8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="hidden w-32 shrink-0 border-l border-border p-3 xl:block">
          <p className="text-xs font-semibold">At a glance</p>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-[0.625rem] text-muted-foreground">Bookings</dt>
              <dd className="text-lg font-semibold">128</dd>
              <p className="text-[0.625rem] text-muted-foreground">+18% vs last week</p>
            </div>
            <div>
              <dt className="text-[0.625rem] text-muted-foreground">Deliveries</dt>
              <dd className="text-lg font-semibold">32</dd>
              <p className="text-[0.625rem] text-muted-foreground">In progress</p>
            </div>
            <div>
              <dt className="text-[0.625rem] text-muted-foreground">Feedback</dt>
              <dd className="text-lg font-semibold">4.9 ★</dd>
              <p className="text-[0.625rem] text-muted-foreground">Average rating</p>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppFrame>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />

          <nav
            aria-label="Public homepage sections"
            className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
          >
            <a href="#features" className="hover:text-primary">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-primary">
              How it works
            </a>
            <a href="#for-businesses" className="hover:text-primary">
              For businesses
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <Button
              asChild
              variant="secondary"
              className="border-primary px-4 text-primary hover:bg-primary/5"
            >
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild className="hidden px-5 sm:inline-flex">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-7 px-4 py-8 sm:gap-9 sm:px-6 sm:py-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-10 lg:px-8 lg:py-12">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary">
              <Store className="size-4" aria-hidden="true" />
              Built for small businesses
            </p>
            <h1 className="mt-5 max-w-2xl text-[1.875rem] font-semibold leading-[1.08] sm:mt-6 sm:text-5xl lg:text-[2.75rem] xl:text-[3.35rem]">
              <span className="block">Manage customers.</span>
              <span className="mt-1 block">Book, deliver, follow up.</span>
              <span className="mt-1 block text-primary">All in one place.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[0.9375rem] leading-6 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-8">
              From bookings to confirmations, deliveries, private feedback, and powerful
              insights — keep every customer experience organized and professional.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:mt-7 sm:flex sm:flex-wrap">
              <Button asChild size="lg" className="h-14 min-w-0 px-4 sm:px-6">
                <Link href="/signup">
                  <span className="lg:hidden">Create account</span>
                  <span className="hidden lg:inline">Get started</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="h-14 min-w-0 border-primary px-4 text-primary sm:px-6 lg:hidden"
              >
                <a href="#features">See how it works</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="hidden h-14 min-w-0 border-primary px-6 text-primary lg:inline-flex"
              >
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>

            <div className="mt-7 hidden flex-wrap gap-x-6 gap-y-3 lg:flex">
              <TrustItem icon={LockKeyhole}>Secure by design</TrustItem>
              <TrustItem icon={ShieldCheck}>Private & confidential</TrustItem>
              <TrustItem icon={Store}>Built for small businesses</TrustItem>
            </div>
          </div>

          <ProductPreview />
        </section>

        <section
          id="features"
          aria-labelledby="features-heading"
          className="scroll-mt-6 border-y border-border bg-card"
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
            <h2 id="features-heading" className="sr-only">
              Features
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className={
                      index === features.length - 1
                        ? "col-span-2 rounded-lg border border-border bg-card p-3 text-center shadow-[0_1px_3px_rgba(23,33,29,0.04)] sm:p-4 lg:col-span-1 lg:p-5"
                        : "rounded-lg border border-border bg-card p-3 text-center shadow-[0_1px_3px_rgba(23,33,29,0.04)] sm:p-4 lg:p-5"
                    }
                  >
                    <span className="mx-auto grid size-9 place-items-center rounded-lg bg-primary/5 text-primary sm:size-10 lg:size-11">
                      <Icon className="size-5 lg:size-6" aria-hidden={true} />
                    </span>
                    <h3 className="mt-2 text-sm font-semibold sm:text-base">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-[1.125rem] text-muted-foreground sm:mt-2 sm:text-sm sm:leading-5">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="hidden scroll-mt-6 md:block"
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-11">
            <h2 id="how-it-works-heading" className="text-center text-2xl font-semibold">
              How it works
            </h2>
            <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {workflow.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="relative flex gap-4 lg:block">
                    <div className="relative w-fit shrink-0">
                      <span className="grid size-14 place-items-center rounded-full bg-primary/5 text-primary">
                        <Icon className="size-6" aria-hidden={true} />
                      </span>
                      <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0 lg:mt-4">
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="for-businesses"
          aria-labelledby="for-businesses-heading"
          className="hidden scroll-mt-6 border-y border-border bg-card md:block"
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
            <h2
              id="for-businesses-heading"
              className="text-center text-2xl font-semibold"
            >
              Perfect for businesses that...
            </h2>
            <div className="mt-8 grid gap-7 md:grid-cols-3 md:gap-0">
              {businessTypes.map((business, index) => {
                const Icon = business.icon;
                return (
                  <article
                    key={business.title}
                    className={`flex gap-4 md:px-7 ${index > 0 ? "md:border-l md:border-border" : ""}`}
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/5 text-primary">
                      <Icon className="size-5" aria-hidden={true} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold">{business.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {business.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-4 rounded-lg bg-primary p-4 text-white min-[430px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[430px]:gap-3 lg:px-8 lg:py-6">
            <div className="contents">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 lg:size-14">
                <Rocket className="size-5 lg:size-7" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold lg:text-xl">
                  {"Run your business. We'll handle the rest."}
                </h2>
                <p className="mt-1 text-xs leading-5 text-white/80 lg:text-base lg:leading-6">
                  Save time, stay organized, and give your customers the experience they
                  deserve.
                </p>
              </div>
            </div>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="col-span-2 h-11 w-full shrink-0 border-white bg-white px-4 text-primary hover:bg-[#f2f5f2] min-[430px]:col-span-1 min-[430px]:w-auto lg:h-12 lg:px-6"
            >
              <Link href="/signup">
                Get started
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-2.5 px-4 py-4 sm:grid-cols-3 sm:gap-3 sm:px-6 sm:py-5 lg:px-8">
          <TrustItem icon={LockKeyhole}>Secure by design</TrustItem>
          <TrustItem icon={ShieldCheck}>Private & confidential</TrustItem>
          <TrustItem icon={Store}>Built for small businesses</TrustItem>
        </div>
      </footer>
    </AppFrame>
  );
}
