import ChatPanel from "./_components/ChatPanel";
import DemoIdentity from "./_components/DemoIdentity";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <DemoIdentity />
      <ChatPanel />
    </main>
  );
}
