import { BASE_URL, authHeaders, safeJson } from './core';

export const llmApi = {
  async getLlmMetrics(clientId: string) {
    const res = await fetch(`${BASE_URL}/llm-metrics/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch LLM metrics');
  },

  async getBudgetStatus(clientId: string) {
    const res = await fetch(`${BASE_URL}/budget-status/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch budget status');
  },

  async getAllBudgetStatuses() {
    const res = await fetch(`${BASE_URL}/admin/budget-status`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch budget statuses');
  },

  async getClientLlmConfig(clientId: string) {
    const res = await fetch(`${BASE_URL}/admin/client-llm-config/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch client LLM configuration');
  },

  async setClientLlmConfig(data: {
    client_id: string;
    caller_function: string;
    global_config_id?: number | null;
    provider?: string | null;
    api_key?: string | null;
    base_url?: string | null;
    model_name: string;
    api_version?: string | null;
  }) {
    const res = await fetch(`${BASE_URL}/admin/client-llm-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update client LLM configuration');
  },

  async refreshClientLlmConfig(data: {
    client_id: string;
    caller_function: string;
    global_config_id?: number | null;
    provider?: string | null;
    api_key?: string | null;
    base_url?: string | null;
    api_version?: string | null;
  }) {
    const res = await fetch(`${BASE_URL}/admin/client-llm-config/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to refresh client LLM configuration');
  },

  async getClientModelConfig(clientId: string) {
    return this.getClientLlmConfig(clientId);
  },

  async setClientModelConfig(data: { client_id: string; caller_function: string; model_name: string }) {
    return this.setClientLlmConfig(data);
  },

  async setClientCostConfig(data: { client_id: string; cost_multiplier: number; monthly_budget_usd?: number | null }) {
    const res = await fetch(`${BASE_URL}/admin/client-cost-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update cost config');
  },

  // 1. Global Default LLM (Single fallback row: global_default_llm)
  async getGlobalDefaultLlm() {
    const res = await fetch(`${BASE_URL}/admin/global-default-llm`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch Global Default LLM');
  },

  async setGlobalDefaultLlm(data: { provider: string; api_key: string; base_url?: string | null; model_name: string; api_version?: string | null }) {
    const res = await fetch(`${BASE_URL}/admin/global-default-llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update Global Default LLM');
  },

  async refreshGlobalDefaultLlm() {
    const res = await fetch(`${BASE_URL}/admin/global-default-llm/refresh`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to refresh Global Default LLM live models');
  },

  async toggleGlobalLlmOverride(is_override_active: boolean) {
    const res = await fetch(`${BASE_URL}/admin/global-default-llm/toggle-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ is_override_active }),
    });
    return safeJson(res, 'Failed to toggle Global LLM Emergency Override');
  },

  // 2. Globally Available LLM Configs (Multiple pool templates: globally_available_llm_configs)
  async getGloballyAvailableLlmConfigs() {
    const res = await fetch(`${BASE_URL}/admin/globally-available-llm-configs`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch globally available LLM configurations');
  },

  async saveGloballyAvailableLlmConfig(data: { id?: number; name: string; provider: string; api_key: string; base_url?: string | null; model_name: string; api_version?: string | null }) {
    const res = await fetch(`${BASE_URL}/admin/globally-available-llm-configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to save globally available LLM configuration');
  },

  async deleteGloballyAvailableLlmConfig(configId: number) {
    const res = await fetch(`${BASE_URL}/admin/globally-available-llm-configs/${configId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete globally available LLM configuration');
  },

  async refreshGloballyAvailableLlmConfig(configId: number) {
    const res = await fetch(`${BASE_URL}/admin/globally-available-llm-configs/${configId}/refresh`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to refresh provider models');
  },

  // Backward compatibility alias for legacy methods
  async getLlmConfigs() {
    return this.getGloballyAvailableLlmConfigs();
  },

  async saveLlmConfig(data: any) {
    return this.saveGloballyAvailableLlmConfig(data);
  },

  async deleteLlmConfig(configId: number) {
    return this.deleteGloballyAvailableLlmConfig(configId);
  },

  async refreshLlmConfig(configId: number) {
    return this.refreshGloballyAvailableLlmConfig(configId);
  },

  async fetchProviderModels(data: { provider: string; api_key: string; base_url?: string; api_version?: string }) {
    const res = await fetch(`${BASE_URL}/admin/llm/fetch-models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to fetch provider models');
  },
};
