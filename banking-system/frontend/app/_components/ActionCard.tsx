"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import type { TransactionSummary, UiAction } from "../_lib/api";
import { LOCALE_TAGS } from "../_lib/i18n";
import type { Dictionary, Locale } from "../_lib/i18n";
import styles from "./ActionCard.module.css";

export type Resolution = "answered" | "confirm" | "cancel";

type ActionCardProps = {
  action: UiAction;
  locale: Locale;
  t: Dictionary;
  disabled: boolean;
  resolution: Resolution | undefined;
  onAnswerVerification: (challengeId: string, answer: string) => void;
  onDecide: (confirmationId: string, decision: "confirm" | "cancel") => void;
};

export default function ActionCard(props: ActionCardProps) {
  const { action } = props;
  switch (action.type) {
    case "step_up_verification":
      return <VerificationCard {...props} action={action} />;
    case "transaction_review":
      return <TransactionReviewCard {...props} action={action} />;
    case "confirm_action":
      return <ConfirmActionCard {...props} action={action} />;
    case "action_result":
      return <ActionResultCard {...props} action={action} />;
    case "handoff_created":
      return <HandoffCard {...props} action={action} />;
  }
}

type CardProps<T extends UiAction["type"]> = Omit<ActionCardProps, "action"> & {
  action: Extract<UiAction, { type: T }>;
};

function VerificationCard({
  action,
  t,
  disabled,
  resolution,
  onAnswerVerification,
}: CardProps<"step_up_verification">) {
  const [answer, setAnswer] = useState("");
  const inputId = `verification-${action.challenge_id}`;
  const answered = resolution === "answered";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = answer.trim();
    if (!value || answered || disabled) return;
    onAnswerVerification(action.challenge_id, value);
    setAnswer("");
  }

  return (
    <section className={`${styles.card} ${styles.info}`} aria-label={t.verification.title}>
      <h3 className={styles.title}>{t.verification.title}</h3>
      <p className={styles.body}>{action.question}</p>
      {answered ? (
        <p className={styles.status}>{t.verification.answered}</p>
      ) : (
        <form className={styles.inlineForm} onSubmit={handleSubmit}>
          <label htmlFor={inputId} className={styles.visuallyHidden}>
            {t.verification.answerLabel}
          </label>
          <input
            id={inputId}
            className={styles.input}
            type="text"
            value={answer}
            placeholder={t.verification.answerLabel}
            onChange={(event) => setAnswer(event.target.value)}
            autoComplete="off"
            maxLength={120}
            disabled={disabled}
          />
          <button
            type="submit"
            className={styles.primary}
            disabled={disabled || answer.trim().length === 0}
          >
            {t.verification.submit}
          </button>
        </form>
      )}
      <p className={styles.note}>{t.verification.note}</p>
    </section>
  );
}

function formatAmount(transaction: TransactionSummary, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: "currency",
    currency: transaction.currency,
  }).format(transaction.amount);
}

function formatDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function TransactionReviewCard({ action, locale, t }: CardProps<"transaction_review">) {
  return (
    <section className={styles.card} aria-label={t.transactions.title(action.card_last_four)}>
      <h3 className={styles.title}>{t.transactions.title(action.card_last_four)}</h3>
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
            {action.transactions.map((transaction) => (
              <tr key={transaction.transaction_id}>
                <td>{formatDate(transaction.date, locale)}</td>
                <td>{transaction.merchant}</td>
                <td className={transaction.city ? undefined : styles.muted}>
                  {transaction.city ?? t.transactions.notRecorded}
                </td>
                <td className={styles.numeric}>{formatAmount(transaction, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConfirmActionCard({
  action,
  t,
  disabled,
  resolution,
  onDecide,
}: CardProps<"confirm_action">) {
  const decided = resolution === "confirm" || resolution === "cancel";

  return (
    <section className={`${styles.card} ${styles.warning}`} aria-label={t.confirmBlock.title}>
      <h3 className={styles.title}>{t.confirmBlock.title}</h3>
      <p className={styles.body}>{t.confirmBlock.body(action.card_last_four)}</p>
      {decided ? (
        <p className={styles.status}>
          {resolution === "confirm" ? t.confirmBlock.confirmed : t.confirmBlock.cancelled}
        </p>
      ) : (
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.danger}
            disabled={disabled}
            onClick={() => onDecide(action.confirmation_id, "confirm")}
          >
            {t.confirmBlock.confirm}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={disabled}
            onClick={() => onDecide(action.confirmation_id, "cancel")}
          >
            {t.confirmBlock.cancel}
          </button>
        </div>
      )}
    </section>
  );
}

function ActionResultCard({ action, t }: CardProps<"action_result">) {
  return (
    <section
      className={`${styles.card} ${action.verified ? styles.success : styles.warning}`}
      role="status"
    >
      <h3 className={styles.title}>
        {action.verified
          ? t.blockResult.verified(action.card_last_four)
          : t.blockResult.unverified(action.card_last_four)}
      </h3>
      <p className={styles.body}>
        {action.verified ? t.blockResult.verifiedNote : t.blockResult.unverifiedNote}
      </p>
    </section>
  );
}

function HandoffCard({ action, t }: CardProps<"handoff_created">) {
  const { handoff } = action;
  return (
    <section className={`${styles.card} ${styles.info}`} aria-label={t.handoff.title}>
      <h3 className={styles.title}>{t.handoff.title}</h3>
      <dl className={styles.facts}>
        <dt>{t.handoff.caseLabel}</dt>
        <dd className={styles.caseId}>{handoff.case_id}</dd>
        <dt>{t.handoff.identityVerified}</dt>
        <dd>{handoff.customer_verified ? t.yes : t.no}</dd>
        <dt>{t.handoff.cardBlocked}</dt>
        <dd>{handoff.card_blocked ? t.yes : t.no}</dd>
      </dl>
      {handoff.actions_taken.length > 0 && (
        <>
          <p className={styles.subtitle}>{t.handoff.actionsTaken}</p>
          <ul className={styles.list}>
            {handoff.actions_taken.map((code) => (
              <li key={code}>{t.handoff.actions[code] ?? code}</li>
            ))}
          </ul>
        </>
      )}
      <p className={styles.note}>{t.handoff.nextStep}</p>
    </section>
  );
}
