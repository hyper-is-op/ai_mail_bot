import { BASE_URL, authHeaders, handleAuthFailure, safeJson, coreApi } from './api/core';
import { authApi } from './api/auth';
import { llmApi } from './api/llm';
import { connectorsApi } from './api/connectors';
import { emailsApi } from './api/emails';
import { draftsApi } from './api/drafts';
import { analyticsApi } from './api/analytics';

export { BASE_URL, authHeaders, handleAuthFailure, safeJson };

export const api = {
  ...coreApi,
  ...authApi,
  ...llmApi,
  ...connectorsApi,
  ...emailsApi,
  ...draftsApi,
  ...analyticsApi,
};

export default api;