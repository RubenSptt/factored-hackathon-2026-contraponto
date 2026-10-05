import ChatPanel from "./_components/ChatPanel";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <ChatPanel />
    </main>
  );
}
