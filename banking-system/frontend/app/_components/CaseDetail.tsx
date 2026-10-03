"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { agentDeskApi } from "../_lib/api";
import type { HandoffCase } from "../_lib/api";
import { dictionaries, LOCALE_TAGS } from "../_lib/i18n";
import type { Dictionary, Locale } from "../_lib/i18n";
import { useLocale } from "../_lib/locale-context";
import { formatAge, intentLabel } from "./agent-format";
import styles from "./AgentDesk.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "missing" }
  | { kind: "ready"; item: HandoffCase; loadedAt: number };

export default function CaseDetail({ caseId }: { caseId: string }) {
  const { locale, t } = useLocale();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    agentDeskApi
      .getHandoff(caseId)
      .then((item) => {
        if (!active) return;
        setState(item ? { kind: "ready", item, loadedAt: Date.now() } : { kind: "missing" });
      })
      .catch(() => {
        if (active) setState({ kind: "error" });
      });
    return () => {
      active = false;
    };
  }, [caseId]);

  return (
    <section className={styles.panel} aria-labelledby="case-title">
      <Link href="/agent" className={styles.backLink}>
        {t.agentDesk.back}
      </Link>

      {state.kind === "loading" && <p className={styles.message}>{t.agentDesk.loading}</p>}
      {state.kind === "error" && (
        <p className={styles.message} role="alert">
          {t.agentDesk.loadError}
        </p>
      )}
      {state.kind === "missing" && (
        <p className={styles.message} role="alert">
          {t.agentDesk.notFound(caseId)}
        </p>
      )}

      {state.kind === "ready" && (
        <CaseBody item={state.item} loadedAt={state.loadedAt} locale={locale} t={t} />
      )}
    </section>
  );
}

type CaseBodyProps = {
  item: HandoffCase;
  loadedAt: number;
  locale: Locale;
  t: Dictionary;
};

function CaseBody({ item, loadedAt, locale, t }: CaseBodyProps) {
  const { handoff } = item;
  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat(LOCALE_TAGS[locale], { style: "currency", currency }).format(amount);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  return (
    <>
      <header className={styles.caseHeader}>
        <div>
          <h1 id="case-title" className={styles.title}>
            {handoff.case_id}
          </h1>
          <p className={styles.subtitle}>
            {intentLabel(handoff.intent, t)} · {t.agentDesk.status[item.status]} ·{" "}
            {formatAge(item.created_at, loadedAt, t)}
          </p>
        </div>
        <span className={`${styles.badge} ${styles[item.priority]}`}>
          {t.agentDesk.priority[item.priority]}
        </span>
      </header>

      <div className={styles.grid}>
        <div className={styles.block}>
          <h2 className={styles.blockTitle}>{t.agentDesk.facts}</h2>
          <dl className={styles.facts}>
            <dt>{t.agentDesk.columns.identity}</dt>
            <dd className={handoff.customer_verified ? undefined : styles.alert}>
              {handoff.customer_verified ? t.agentDesk.verified : t.agentDesk.notVerified}
            </dd>
            <dt>{t.agentDesk.columns.card}</dt>
            <dd>
              {handoff.card_last_four ? `•••• ${handoff.card_last_four}` : t.agentDesk.noCard}
            </dd>
            <dt>{t.handoff.cardBlocked}</dt>
            <dd>{handoff.card_blocked ? t.yes : t.no}</dd>
            <dt>{t.agentDesk.customerLanguage}</dt>
            <dd>{dictionaries[item.customer_locale].localeName}</dd>
          </dl>
        </div>

        <div className={styles.block}>
          <h2 className={styles.blockTitle}>{t.agentDesk.riskReason}</h2>
          <p className={styles.text}>{handoff.risk_reason}</p>
          <h2 className={styles.blockTitle}>{t.agentDesk.actionsTaken}</h2>
          <ul className={styles.list}>
            {handoff.actions_taken.map((code) => (
              <li key={code}>{t.handoff.actions[code] ?? code}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.block}>
        <h2 className={styles.blockTitle}>{t.agentDesk.flaggedTransactions}</h2>
        {handoff.suspicious_transactions.length === 0 ? (
          <p className={styles.muted}>{t.agentDesk.noFlaggedTransactions}</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t.transactions.date}</th>
                  <th scope="col">{t.transactions.merchant}</th>
                  <th scope="col">{t.transactions.city}</th>
                  <th scope="col" className={styles.numeric}>
                    {t.transactions.amount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {handoff.suspicious_transactions.map((transaction) => (
                  <tr key={transaction.transaction_id}>
                    <td>{formatDate(transaction.date)}</td>
                    <td>{transaction.merchant}</td>
                    <td className={transaction.city ? undefined : styles.muted}>
                      {transaction.city ?? t.transactions.notRecorded}
                    </td>
                    <td className={styles.numeric}>
                      {formatAmount(transaction.amount, transaction.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`${styles.block} ${styles.questions}`}>
        <h2 className={styles.blockTitle}>{t.agentDesk.openQuestions}</h2>
        <ol className={styles.list}>
          {handoff.unresolved_questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      </div>

      <p className={styles.note}>{t.agentDesk.noTranscript}</p>

      <details className={styles.raw}>
        <summary>{t.agentDesk.rawJson}</summary>
        <pre>{JSON.stringify(handoff, null, 2)}</pre>
      </details>
    </>
  );
}
