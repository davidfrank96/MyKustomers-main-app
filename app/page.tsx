import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  LockKeyhole,
  Mail,
  MessageCircle,
  Rocket,
  ShieldCheck,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { AppFrame } from "@/components/layout/app-frame";
import { HomepageProductDemo } from "@/components/homepage/homepage-product-demo";
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
    description: "Keep customer details organized and easy to access.",
    icon: Users,
  },
  {
    title: "Bookings",
    description: "Create, manage, and track every booking with ease.",
    icon: CalendarDays,
  },
  {
    title: "Digital receipts",
    description: "Send digital receipts and customer updates automatically.",
    icon: Mail,
  },
  {
    title: "Feedback",
    description: "Collect private feedback and respond quickly.",
    icon: MessageCircle,
  },
  {
    title: "Insights",
    description: "See what's working and grow with confidence.",
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
              <span className="block">From customer request to</span>
              <span className="mt-1 block">confirmation, delivery, and feedback —</span>
              <span className="mt-1 block text-primary">one clear journey.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[0.9375rem] leading-6 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-8">
              Manage bookings, send digital receipts and updates, collect private
              feedback, and keep every customer journey organized in one place.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:mt-7 sm:flex sm:flex-wrap">
              <Button asChild size="lg" className="h-14 min-w-0 px-4 sm:px-6">
                <Link href="/signup">
                  <span className="lg:hidden">Get started</span>
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

          <HomepageProductDemo />
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
                  Save time, look professional, and give your customers the experience
                  they deserve.
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
