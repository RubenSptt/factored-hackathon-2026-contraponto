// HTTP client for the backend route handlers under /api.
// Identity travels only in the httpOnly session cookie set by /api/session;
// no request body carries a customer_id.

import type {
  AgentDeskApi,
  CardSupportApi,
  ChatResponse,
  HandoffCase,
} from "./contracts";

const DEMO_CUSTOMER_KEY = "card-support-demo-customer";
export const DEFAULT_DEMO_CUSTOMER = "C-1001";

export function selectedDemoCustomer(): string {
  try {
    return window.localStorage.getItem(DEMO_CUSTOMER_KEY) ?? DEFAULT_DEMO_CUSTOMER;
  } catch {
    return DEFAULT_DEMO_CUSTOMER;
  }
}

export function selectDemoCustomer(id: string): void {
  try {
    window.localStorage.setItem(DEMO_CUSTOMER_KEY, id);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  customerSession = null;
}

let customerSession: Promise<void> | null = null;
let agentSession: Promise<void> | null = null;

async function signIn(body: Record<string, string>): Promise<void> {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`sign-in failed: ${response.status}`);
}

export function ensureCustomerSession(): Promise<void> {
  customerSession ??= signIn({ role: "customer", demo_customer: selectedDemoCustomer() }).catch((error) => {
    customerSession = null;
    throw error;
  });
  return customerSession;
}

async function postChat(path: string, body: object): Promise<ChatResponse> {
  await ensureCustomerSession();
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    // The server already refused the request and explains why; the customer
    // signs in again on the next message.
    customerSession = null;
    return (await response.json()) as ChatResponse;
  }
  if (!response.ok && response.status !== 403) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as ChatResponse;
}

export const httpCardSupportApi: CardSupportApi = {
  sendMessage: (request) => postChat("/api/chat/messages", request),
  answerVerification: (request) => postChat("/api/chat/verification", request),
  confirmAction: (request) => postChat("/api/chat/confirmations", request),
};

async function getAgent<T>(path: string): Promise<T | null> {
  agentSession ??= signIn({ role: "agent" }).catch((error) => {
    agentSession = null;
    throw error;
  });
  await agentSession;
  const response = await fetch(path, { cache: "no-store" });
  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) agentSession = null;
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as T;
}

export const httpAgentDeskApi: AgentDeskApi = {
  listHandoffs: async () => (await getAgent<HandoffCase[]>("/api/agent/handoffs")) ?? [],
  getHandoff: (caseId) => getAgent<HandoffCase>(`/api/agent/handoffs/${encodeURIComponent(caseId)}`),
};
