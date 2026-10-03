import CaseDetail from "../../_components/CaseDetail";
import styles from "../../_components/AgentDesk.module.css";

// Next.js 16: route params are a Promise and must be awaited.
export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <main className={styles.page}>
      <CaseDetail caseId={decodeURIComponent(caseId)} />
    </main>
  );
}
