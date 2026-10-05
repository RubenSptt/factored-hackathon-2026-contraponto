"use client";

// Which store answers the agent's tools, and how fresh it is: read from
// /api/health so the agent desk shows the same lineage the server reports.

import { useEffect, useState } from "react";

import { LOCALE_TAGS } from "../_lib/i18n";
import { useLocale } from "../_lib/locale-context";
import styles from "./AgentDesk.module.css";

type Rows = Record<string, { dataset: number; test_fixture: number }>;
type Health = {
  data_source?: "postgres" | "snapshot";
  postgres?: { last_load_run?: { load_run_id: number; finished_at: string; source_exported_at: string; rows: Rows } | null };
  data?: { snapshot?: string; source_exported_at?: string; rows?: Record<string, number> };
};

export default function DataSource() {
  const { locale, t } = useLocale();
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/health", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Health | null) => {
        if (active) setHealth(body);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!health?.data_source) return null;
  const d = t.agentDesk.dataSource;
  const tag = LOCALE_TAGS[locale];
  const date = (iso: string) => new Date(iso).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const n = (value: number) => value.toLocaleString(tag);
  const run = health.data_source === "postgres" ? health.postgres?.last_load_run : null;

  let source: string;
  let detail: string[];
  if (run) {
    const total = (key: string) => (run.rows[key]?.dataset ?? 0) + (run.rows[key]?.test_fixture ?? 0);
    source = d.postgres;
    detail = [
      `${d.exported} ${date(run.source_exported_at)}`,
      `${d.loaded} ${run.load_run_id} · ${date(run.finished_at)}`,
      `${n(total("customers"))} ${d.customers}, ${n(total("cards"))} ${d.cards}, ${n(total("transactions"))} ${d.transactions}`,
    ];
  } else {
    const rows = health.data?.rows ?? {};
    source = `${d.snapshot} ${health.data?.snapshot ?? ""}`.trim();
    detail = [
      health.data?.source_exported_at ? `${d.sample} ${date(health.data.source_exported_at)}` : "",
      `${n(rows.customers ?? 0)} ${d.customers}, ${n(rows.cards ?? 0)} ${d.cards}, ${n(rows.transactions ?? 0)} ${d.transactions}`,
    ].filter(Boolean);
  }

  return (
    <p className={styles.source}>
      <span className={run ? styles.sourceLive : styles.sourceFallback} aria-hidden="true" />
      <b>{d.label}:</b> {source} · {detail.join(" · ")}
    </p>
  );
}
