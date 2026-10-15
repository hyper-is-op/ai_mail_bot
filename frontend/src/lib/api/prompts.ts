import { BASE_URL, authHeaders, safeJson } from './core';

export interface PromptConfigItem {
  key: string;
  title: string;
  description: string;
  variables: string[];
  default_text: string;
  active_text: string;
  is_custom: boolean;
  updated_at?: string | null;
}

export const promptsApi = {
  async getPrompts(): Promise<PromptConfigItem[]> {
    const res = await fetch(`${BASE_URL}/settings/prompts`, {
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to fetch prompt configurations');
  },

  async updatePrompt(key: string, promptText: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/settings/prompts/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ prompt_text: promptText }),
    });
    return safeJson(res, 'Failed to update prompt');
  },

  async resetPrompt(key: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/settings/prompts/${encodeURIComponent(key)}/reset`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to reset prompt');
  },

  async resetAllPrompts(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/settings/prompts/reset-all`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to reset all prompts');
  },
};
