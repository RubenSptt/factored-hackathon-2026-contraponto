"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { cardSupportApi } from "../_lib/api";
import type { ChatResponse, UiAction } from "../_lib/api";
import { containsFullCardNumber } from "../_lib/card-number-guard";
import { useLocale } from "../_lib/locale-context";
import ActionCard from "./ActionCard";
import type { Resolution } from "./ActionCard";
import styles from "./ChatPanel.module.css";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions: UiAction[];
};

type Notice = "sendError" | "cardNumberWarning" | null;

function withoutKey(record: Record<string, Resolution>, key: string) {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

function actionKey(action: UiAction): string | null {
  if (action.type === "step_up_verification") return action.challenge_id;
  if (action.type === "confirm_action") return action.confirmation_id;
  return null;
}

export default function ChatPanel() {
  const { locale, t } = useLocale();
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  function appendMessage(role: ChatMessage["role"], text: string, actions: UiAction[] = []) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text, actions }]);
  }

  // Runs one backend call and renders the agent's reply and UI actions.
  async function runRequest(request: () => Promise<ChatResponse>): Promise<boolean> {
    setIsSending(true);
    try {
      const response = await request();
      appendMessage("assistant", response.reply, response.ui_actions);
      return true;
    } catch {
      setNotice("sendError");
      return false;
    } finally {
      setIsSending(false);
    }
  }

  async function submitMessage(text: string) {
    const message = text.trim();
    if (!message || isSending) return;

    if (containsFullCardNumber(message)) {
      setNotice("cardNumberWarning");
      return;
    }

    setNotice(null);
    setDraft("");
    appendMessage("user", message);
    await runRequest(() =>
      cardSupportApi.sendMessage({ session_id: sessionId, message, locale }),
    );
  }

  async function answerVerification(challengeId: string, answer: string) {
    if (isSending) return;
    setNotice(null);
    setResolutions((current) => ({ ...current, [challengeId]: "answered" }));
    // The answer is not echoed into the transcript: it is a security answer.
    const ok = await runRequest(() =>
      cardSupportApi.answerVerification({
        session_id: sessionId,
        challenge_id: challengeId,
        answer,
        locale,
      }),
    );
    if (!ok) {
      setResolutions((current) => withoutKey(current, challengeId));
    }
  }

  async function decide(confirmationId: string, decision: "confirm" | "cancel") {
    if (isSending) return;
    setNotice(null);
    setResolutions((current) => ({ ...current, [confirmationId]: decision }));
    const ok = await runRequest(() =>
      cardSupportApi.confirmAction({
        session_id: sessionId,
        confirmation_id: confirmationId,
        decision,
        locale,
      }),
    );
    if (!ok) {
      setResolutions((current) => withoutKey(current, confirmationId));
    }
  }

  function resetConversation() {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setResolutions({});
    setDraft("");
    setNotice(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submitMessage(draft);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="assistant-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 id="assistant-title" className={styles.title}>
            {t.title}
          </h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>

        <div className={styles.headerControls}>
          {messages.length > 0 && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={resetConversation}
              disabled={isSending}
            >
              {t.newConversation}
            </button>
          )}
        </div>
      </header>

      <div className={styles.messages} role="log" aria-live="polite">
        <div className={`${styles.bubble} ${styles.assistant}`}>
          <span className={styles.author}>{t.assistantLabel}</span>
          <p>{t.greeting}</p>
        </div>

        {messages.length === 0 && (
          <div className={styles.suggestions}>
            <p className={styles.suggestionsLabel}>{t.suggestionsLabel}</p>
            <ul>
              {t.suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    className={styles.suggestion}
                    onClick={() => void submitMessage(suggestion)}
                    disabled={isSending}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.turn} ${
              message.role === "user" ? styles.userTurn : styles.assistantTurn
            }`}
          >
            <div
              className={`${styles.bubble} ${
                message.role === "user" ? styles.user : styles.assistant
              }`}
            >
              <span className={styles.author}>
                {message.role === "user" ? t.youLabel : t.assistantLabel}
              </span>
              <p>{message.text}</p>
            </div>

            {message.actions.map((action, index) => {
              const key = actionKey(action);
              return (
                <div key={`${message.id}-${index}`} className={styles.actionSlot}>
                  <ActionCard
                    action={action}
                    locale={locale}
                    t={t}
                    disabled={isSending}
                    resolution={key ? resolutions[key] : undefined}
                    onAnswerVerification={(challengeId, answer) =>
                      void answerVerification(challengeId, answer)
                    }
                    onDecide={(confirmationId, decision) =>
                      void decide(confirmationId, decision)
                    }
                  />
                </div>
              );
            })}
          </div>
        ))}

        {isSending && (
          <div className={`${styles.bubble} ${styles.assistant} ${styles.typing}`}>
            <span className={styles.author}>{t.assistantLabel}</span>
            <p>{t.typing}</p>
          </div>
        )}

        <div ref={endOfMessagesRef} />
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        {notice && (
          <p className={styles.notice} role="alert">
            {t[notice]}
          </p>
        )}

        <label htmlFor="chat-input" className={styles.visuallyHidden}>
          {t.inputLabel}
        </label>
        <div className={styles.inputRow}>
          <textarea
            id="chat-input"
            className={styles.input}
            rows={2}
            value={draft}
            placeholder={t.inputPlaceholder}
            onChange={(event) => {
              setDraft(event.target.value);
              if (notice === "cardNumberWarning") setNotice(null);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            maxLength={1000}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isSending || draft.trim().length === 0}
          >
            {isSending ? t.sending : t.send}
          </button>
        </div>
        <p className={styles.hint}>{t.inputHint}</p>
        <p className={styles.disclaimer}>{t.disclaimer}</p>
      </form>
    </section>
  );
}
