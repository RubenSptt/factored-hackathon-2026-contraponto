"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { agentDeskApi } from "../_lib/api";
import type { HandoffCase } from "../_lib/api";
import { useLocale } from "../_lib/locale-context";
import { formatAge, intentLabel, sortForTriage } from "./agent-format";
import styles from "./AgentDesk.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; cases: HandoffCase[]; loadedAt: number };

export default function AgentQueue() {
  const { t } = useLocale();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    agentDeskApi
      .listHandoffs()
      .then((cases) => {
        if (active) setState({ kind: "ready", cases: sortForTriage(cases), loadedAt: Date.now() });
      })
      .catch(() => {
        if (active) setState({ kind: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className={styles.panel} aria-labelledby="queue-title">
      <header className={styles.header}>
        <h1 id="queue-title" className={styles.title}>
          {t.agentDesk.title}
        </h1>
        <p className={styles.subtitle}>{t.agentDesk.subtitle}</p>
      </header>

      {state.kind === "loading" && <p className={styles.message}>{t.agentDesk.loading}</p>}
      {state.kind === "error" && (
        <p className={styles.message} role="alert">
          {t.agentDesk.loadError}
        </p>
      )}
      {state.kind === "ready" && state.cases.length === 0 && (
        <p className={styles.message}>{t.agentDesk.empty}</p>
      )}

      {state.kind === "ready" && state.cases.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.agentDesk.columns.caseId}</th>
                <th scope="col">{t.agentDesk.columns.priority}</th>
                <th scope="col">{t.agentDesk.columns.reason}</th>
                <th scope="col">{t.agentDesk.columns.identity}</th>
                <th scope="col">{t.agentDesk.columns.card}</th>
                <th scope="col">{t.agentDesk.columns.opened}</th>
                <th scope="col">{t.agentDesk.columns.status}</th>
              </tr>
            </thead>
            <tbody>
              {state.cases.map((item) => {
                const { handoff } = item;
                return (
                  <tr key={handoff.case_id}>
                    <td>
                      <Link href={`/agent/${handoff.case_id}`} className={styles.caseLink}>
                        {handoff.case_id}
                      </Link>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[item.priority]}`}>
                        {t.agentDesk.priority[item.priority]}
                      </span>
                    </td>
                    <td>{intentLabel(handoff.intent, t)}</td>
                    <td className={handoff.customer_verified ? undefined : styles.alert}>
                      {handoff.customer_verified ? t.agentDesk.verified : t.agentDesk.notVerified}
                    </td>
                    <td>
                      {handoff.card_last_four ? (
                        <>
                          •••• {handoff.card_last_four}
                          <span className={styles.cellNote}>
                            {handoff.card_blocked ? t.agentDesk.blocked : t.agentDesk.notBlocked}
                          </span>
                        </>
                      ) : (
                        <span className={styles.muted}>{t.agentDesk.noCard}</span>
                      )}
                    </td>
                    <td>{formatAge(item.created_at, state.loadedAt, t)}</td>
                    <td>{t.agentDesk.status[item.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.note}>{t.agentDesk.demoNote}</p>
    </section>
  );
}
