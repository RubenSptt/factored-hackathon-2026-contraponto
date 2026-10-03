// Single entry point for backend access from the UI.
// Swap the mock for the HTTP client here once the FastAPI endpoints exist.

import { mockCardSupportApi } from "./mock-api";

export const cardSupportApi = mockCardSupportApi;

export type * from "./contracts";
