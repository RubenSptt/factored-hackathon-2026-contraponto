import AgentQueue from "../_components/AgentQueue";
import styles from "../_components/AgentDesk.module.css";

export default function AgentQueuePage() {
  return (
    <main className={styles.page}>
      <AgentQueue />
    </main>
  );
}
