"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { containsFullCardNumber } from "../_lib/card-number-guard";
import { sendChatMessage } from "../_lib/chat-transport";
import { DEFAULT_LOCALE, dictionaries, isLocale, LOCALES } from "../_lib/i18n";
import type { Locale } from "../_lib/i18n";
import styles from "./ChatPanel.module.css";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type Notice = "sendError" | "cardNumberWarning" | null;

export default function ChatPanel() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const t = dictionaries[locale];

  // Keep the document language in sync for screen readers and translators.
  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : "es";
  }, [locale]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function submit(text: string) {
    const message = text.trim();
    if (!message || isSending) return;

    if (containsFullCardNumber(message)) {
      setNotice("cardNumberWarning");
      return;
    }

    setNotice(null);
    setDraft("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: message },
    ]);
    setIsSending(true);

    try {
      const reply = await sendChatMessage(message, locale);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text: reply.text },
      ]);
    } catch {
      setNotice("sendError");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit(draft);
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

        <div className={styles.localeSwitch} role="group" aria-label={t.languageLabel}>
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.localeButton}
              aria-pressed={option === locale}
              onClick={() => {
                if (isLocale(option)) setLocale(option);
              }}
            >
              {dictionaries[option].localeName}
            </button>
          ))}
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
                    onClick={() => void submit(suggestion)}
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
            className={`${styles.bubble} ${
              message.role === "user" ? styles.user : styles.assistant
            }`}
          >
            <span className={styles.author}>
              {message.role === "user" ? t.youLabel : t.assistantLabel}
            </span>
            <p>{message.text}</p>
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
