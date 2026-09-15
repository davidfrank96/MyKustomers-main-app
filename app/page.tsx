import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  ClipboardList,
  Mail,
  MessageCircle,
  Store,
  Truck,
} from "lucide-react";
import { HomepageProductDemo } from "@/components/homepage/homepage-product-demo";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";
import {
  HOMEPAGE_SEO,
  SEO_SITE,
  buildHomepageStructuredData,
  serializeStructuredData,
} from "@/lib/seo/site";
import styles from "./homepage.module.css";

export const metadata: Metadata = {
  title: { absolute: HOMEPAGE_SEO.title },
  description: HOMEPAGE_SEO.description,
  applicationName: HOMEPAGE_SEO.name,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOMEPAGE_SEO.title,
    description: HOMEPAGE_SEO.description,
    url: SEO_SITE.origin,
    siteName: HOMEPAGE_SEO.name,
    type: "website",
    locale: "en_NG",
    images: [
      {
        url: MYKUSTOMERS_BRAND_ASSETS.openGraph,
        width: 1200,
        height: 630,
        alt: "MyKustomers.com",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOMEPAGE_SEO.title,
    description: HOMEPAGE_SEO.description,
    images: [MYKUSTOMERS_BRAND_ASSETS.openGraph],
  },
};

const journey = [
  { label: "Request", icon: ClipboardList },
  { label: "Confirmation", icon: Mail },
  { label: "Updates", icon: Bell },
  { label: "Delivery", icon: Truck },
  { label: "Feedback", icon: MessageCircle },
] as const;

export default function HomePage() {
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(buildHomepageStructuredData()),
        }}
      />
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="MyKustomers.com home">
          <BrandLogo variant="horizontal" decorative priority />
        </Link>
        <nav aria-label="Public homepage sections" className={styles.navigation}>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#for-businesses">For businesses</a>
        </nav>
        <div className={styles.headerActions}>
          <Button asChild variant="secondary" className={styles.login}>
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className={styles.headerSignup}>
            <Link href="/signup">
              Get started <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="homepage-heading">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <Store aria-hidden="true" />
              <span>For businesses that manage customer work from order to delivery</span>
            </p>
            <h1 id="homepage-heading" className={styles.headline}>
              <span>Keep every</span>{" "}
              <span>
                customer in the loop<span className={styles.period}>.</span>
              </span>
            </h1>
            <p className={styles.description}>
              From confirmation to delivery and feedback, MyKustomers helps businesses
              give customers a clear, professional experience.
            </p>
            <p className={styles.support}>
              Confirm what was agreed. Keep customers updated. Manage changes. Deliver
              professionally.
            </p>
            <div className={styles.heroActions}>
              <Button asChild size="lg" className={styles.primaryCta}>
                <Link href="/signup">
                  Get started <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className={`${styles.secondaryCta} ${styles.mobileDemoLink}`}
              >
                <a href="#features">See how it works</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className={`${styles.secondaryCta} ${styles.desktopJourneyLink}`}
              >
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
          </div>
          <div id="features" className={styles.showcase}>
            <HomepageProductDemo />
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className={styles.journey}
        >
          <h2 id="how-it-works-heading">One clear journey</h2>
          <ol className={styles.journeySteps}>
            {journey.map(({ label, icon: Icon }, index) => (
              <li key={label} className={styles.journeyStep}>
                <span className={styles.journeyIcon}>
                  <Icon aria-hidden="true" />
                </span>
                <span>{label}</span>
                {index < journey.length - 1 && (
                  <ArrowRight className={styles.journeyArrow} aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </section>

        <section
          id="for-businesses"
          className={styles.finalCta}
          aria-labelledby="final-cta-heading"
        >
          <div>
            <h2 id="final-cta-heading">Good work deserves good communication.</h2>
            <p>Give your customers a professional experience from start to finish.</p>
          </div>
          <Button asChild size="lg" variant="secondary" className={styles.finalButton}>
            <Link href="/signup">
              Get started <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className={styles.footer}>
        <BrandLogo variant="horizontal" className={styles.footerBrand} />
        <nav aria-label="Footer navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link href="/login">Log in</Link>
        </nav>
      </footer>
    </div>
  );
}
