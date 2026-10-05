// Single entry point for backend access from the UI.
// NEXT_PUBLIC_API_MODE=mock runs the in-browser mock (no server needed);
// anything else talks to the route handlers under /api.

import { httpAgentDeskApi, httpCardSupportApi } from "./http-api";
import { mockAgentDeskApi, mockCardSupportApi } from "./mock-api";

const useMock = process.env.NEXT_PUBLIC_API_MODE === "mock";

export const cardSupportApi = useMock ? mockCardSupportApi : httpCardSupportApi;
export const agentDeskApi = useMock ? mockAgentDeskApi : httpAgentDeskApi;

export type * from "./contracts";
