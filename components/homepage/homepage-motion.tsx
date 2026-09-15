import { CalendarDays, Check, Heart, MessageCircle, Truck } from "lucide-react";
import styles from "./homepage-motion.module.css";

function Annotation({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.annotation} ${className}`} aria-hidden="true">
      <div className={styles.annotationDrift}>
        <span>{children}</span>
        <svg viewBox="0 0 75 60" fill="none" focusable="false" aria-hidden="true">
          <path pathLength="1" d="M12 3 C7 28 28 46 62 43 M54 35 L63 43 L54 51" />
        </svg>
      </div>
    </div>
  );
}

export function HomepageHeroSignals() {
  return (
    <>
      <div className={styles.ambient} aria-hidden="true" />
      <ul className={styles.signals} aria-label="Illustrative customer updates">
        <li
          className={`${styles.signal} ${styles.confirmation}`}
          data-hero-signal="confirmation"
        >
          <div className={styles.signalCycle}>
            <div className={styles.signalCard}>
              <span className={`${styles.signalIcon} ${styles.confirmIcon}`}>
                <Check aria-hidden="true" />
              </span>
              <div>
                <strong>Customer confirmed</strong>
                <span>Just now</span>
              </div>
            </div>
          </div>
        </li>
        <li className={`${styles.signal} ${styles.reaction}`} data-hero-signal="reaction">
          <div className={styles.signalCycle}>
            <div className={styles.signalCard}>
              <span className={styles.signalIcon}>
                <MessageCircle aria-hidden="true" />
              </span>
              <div>
                <strong>Looks great!</strong>
                <span>Thank you! 🙌</span>
              </div>
            </div>
          </div>
        </li>
        <li className={`${styles.signal} ${styles.delivery}`} data-hero-signal="delivery">
          <div className={styles.signalCycle}>
            <div className={styles.signalCard}>
              <span className={styles.signalIcon}>
                <Truck aria-hidden="true" />
              </span>
              <div>
                <strong>Out for delivery</strong>
                <span>Today, 2:00 PM</span>
              </div>
            </div>
          </div>
        </li>
      </ul>
      <Annotation className={styles.orders}>
        Orders <br />
        confirmed
      </Annotation>
      <Annotation className={styles.happier}>
        Happier <br />
        customers
      </Annotation>
    </>
  );
}

const wirePath = "M95 132 C98 220 226 265 243 165 S324 167 370 210 S432 245 495 227";
const mobileWirePath = "M130 80 C20 85 18 165 160 188 S275 295 120 370";

function Wire({ mobile = false }: { mobile?: boolean }) {
  const path = mobile ? mobileWirePath : wirePath;
  return (
    <svg
      className={`${styles.wire} ${mobile ? styles.mobileWire : styles.desktopWire}`}
      viewBox={mobile ? "0 0 300 430" : "0 0 600 310"}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-motion-wire={mobile ? "mobile" : "desktop"}
    >
      <path className={styles.wirePath} d={path} pathLength="1" />
      <g className={styles.pulse}>
        <circle r="8" fill="#168660" opacity=".13" />
        <circle r="3" fill="#168660" />
        <animateMotion path={path} dur="6s" begin="2s" repeatCount="indefinite" />
      </g>
    </svg>
  );
}

export function HomepageLoyaltyVisual() {
  return (
    <div className={styles.loyaltyVisual}>
      <div className={styles.wireDrift}>
        <Wire />
        <Wire mobile />
      </div>
      <ol
        className={styles.loyaltyCards}
        aria-label="From a confirmed booking to customer feedback"
      >
        <li className={`${styles.loyaltyCard} ${styles.bookingCard}`}>
          <div className={styles.updateCard}>
            <span className={styles.updateIcon}>
              <CalendarDays aria-hidden="true" />
            </span>
            <div>
              <strong>Booking confirmed</strong>
              <p>Your booking is confirmed!</p>
              <span>10:00 AM</span>
            </div>
          </div>
        </li>
        <li className={`${styles.loyaltyCard} ${styles.deliveryCard}`}>
          <div className={styles.updateCard}>
            <span className={styles.updateIcon}>
              <Truck aria-hidden="true" />
            </span>
            <div>
              <strong>Out for delivery</strong>
              <p>Your order is on the way!</p>
              <span>2:00 PM</span>
            </div>
          </div>
        </li>
        <li className={`${styles.loyaltyCard} ${styles.thanksCard}`}>
          <div className={styles.updateCard}>
            <span className={styles.updateIcon}>
              <Heart aria-hidden="true" />
            </span>
            <div>
              <strong>Thank you!</strong>
              <p>Your feedback means a lot.</p>
              <span>Private feedback</span>
            </div>
          </div>
        </li>
      </ol>
      <Annotation className={styles.relationships}>
        Stronger <br />
        relationships
      </Annotation>
    </div>
  );
}
