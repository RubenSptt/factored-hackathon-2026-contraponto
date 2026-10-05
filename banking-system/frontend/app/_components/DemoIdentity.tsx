"use client";

// Picks the trusted test session the chat runs under. Stands in for the bank's
// login (Cognito in production); the server issues the session cookie.

import { useEffect, useState } from "react";

import { selectDemoCustomer, selectedDemoCustomer } from "../_lib/api/http-api";
import { useLocale } from "../_lib/locale-context";
import styles from "./DemoIdentity.module.css";

type DemoCustomer = { id: string; name: string };

export default function DemoIdentity() {
  const { locale } = useLocale();
  const [customers, setCustomers] = useState<DemoCustomer[]>([]);
  const [current, setCurrent] = useState<string>("");

  useEffect(() => {
    setCurrent(selectedDemoCustomer());
    fetch("/api/session")
      .then((response) => response.json())
      .then((data: { demo_customers: DemoCustomer[] }) => setCustomers(data.demo_customers))
      .catch(() => setCustomers([]));
  }, []);

  if (process.env.NEXT_PUBLIC_API_MODE === "mock" || customers.length === 0) return null;

  return (
    <label className={styles.bar}>
      <span>{locale === "es" ? "Sesión de prueba como" : "Sessão de teste como"}</span>
      <select
        value={current}
        onChange={(event) => {
          selectDemoCustomer(event.target.value);
          window.location.reload();
        }}
      >
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.id} · {customer.name}
          </option>
        ))}
      </select>
      <span className={styles.note}>
        {locale === "es" ? "Datos ficticios de prueba" : "Dados fictícios de teste"}
      </span>
    </label>
  );
}
