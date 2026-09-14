export const PROVIDER_DEFAULT_URLS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
  claude: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  grok: 'https://api.x.ai/v1',
  azure: '',
  custom: '',
};

export const PROVIDER_SAMPLE_MODELS: Record<string, string[]> = {
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'o3-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  claude: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ],
  gemini: [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-8b',
  ],
  grok: [
    'grok-2-latest',
    'grok-2-vision-latest',
    'grok-beta',
  ],
  azure: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4',
  ],
  custom: [],
};

export interface CallerFunctionDefinition {
  key: string;
  label: string;
  desc: string;
}

export const CALLER_FUNCTIONS: CallerFunctionDefinition[] = [
  { key: 'detect_intent_llm', label: 'Intent Detection & Ticket Classifier', desc: 'Analyzes customer emails to classify intent and decide ticket creation.' },
  { key: 'generate_reply_llm', label: 'AI Auto-Reply Generator', desc: 'Generates conversational, brand-aligned email resolutions.' },
  { key: 'design_payload', label: 'Tool & Action Payload Generator', desc: 'Constructs structured JSON payloads for third-party connector APIs.' },
  { key: 'scan_history_for_ticket', label: 'Historical Ticket Scanner', desc: 'Scans previous thread history to locate existing ticket IDs.' },
  { key: 'extract_issue_description', label: 'Issue Description Extractor', desc: 'Extracts clear problem summaries for ticket titles and CRM.' },
  { key: 'generate_summary_llm', label: 'Email Thread Summarizer', desc: 'Creates concise summaries of lengthy multi-turn email chains.' },
  { key: 'llm_score', label: 'Confidence & Sentiment Scorer', desc: 'Calculates response confidence and customer sentiment metrics.' },
];

export interface GlobalDefaultState {
  provider: string;
  api_key: string;
  base_url: string;
  model_name: string;
  api_version: string;
  refreshed: string | null;
  is_override_active: boolean;
}

export interface GloballyAvailableConfig {
  id: number;
  name: string;
  provider: string;
  api_key: string;
  base_url?: string | null;
  model_name: string;
  api_version?: string | null;
  refreshed?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AvailFormState {
  id?: number;
  name: string;
  provider: string;
  api_key: string;
  base_url: string;
  model_name: string;
  api_version: string;
}

export interface ClientFunctionConfig {
  mode: 'global' | 'custom';
  global_config_id?: number;
  provider: string;
  api_key: string;
  base_url: string;
  model_name: string;
  api_version: string;
  updated_at?: string;
  refreshed?: string | null;
}

export type ClientConfigsMap = Record<string, ClientFunctionConfig>;
