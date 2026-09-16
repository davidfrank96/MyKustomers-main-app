import type { CSSProperties, ReactNode } from "react";
import { Bell, ClipboardList, Mail, MessageCircle, Truck } from "lucide-react";
import styles from "./homepage-headline-loop.module.css";

const stages = [ClipboardList, Mail, Bell, Truck, MessageCircle];

/** Decorative server markup; the existing homepage controller owns playback. */
export function HomepageHeadlineLoop({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame} data-homepage-motion="headline">
      {children}
      <div className={styles.orbit} aria-hidden="true">
        <svg className={styles.line} width="100%" height="100%" focusable="false">
          <rect width="100%" height="100%" rx="18%" ry="44%" />
        </svg>
        {stages.map((Icon, index) => (
          <span
            key={index}
            className={styles.node}
            style={{ "--position": `${index * 20 + 6}%` } as CSSProperties}
          >
            <Icon aria-hidden="true" />
          </span>
        ))}
      </div>
    </div>
  );
}
