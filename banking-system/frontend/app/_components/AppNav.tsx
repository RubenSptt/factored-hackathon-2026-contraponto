"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { dictionaries, LOCALES } from "../_lib/i18n";
import { useLocale } from "../_lib/locale-context";
import styles from "./AppNav.module.css";

export default function AppNav() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const onAgentDesk = pathname.startsWith("/agent");

  return (
    <nav className={styles.nav} aria-label={t.nav.brand}>
      <span className={styles.brand}>{t.nav.brand}</span>

      <div className={styles.links}>
        <Link
          href="/"
          className={styles.link}
          aria-current={onAgentDesk ? undefined : "page"}
        >
          {t.nav.customer}
        </Link>
        <Link
          href="/agent"
          className={styles.link}
          aria-current={onAgentDesk ? "page" : undefined}
        >
          {t.nav.agent}
        </Link>
      </div>

      <div className={styles.localeSwitch} role="group" aria-label={t.languageLabel}>
        {LOCALES.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.localeButton}
            aria-pressed={option === locale}
            onClick={() => setLocale(option)}
          >
            {dictionaries[option].localeName}
          </button>
        ))}
      </div>
    </nav>
  );
}
