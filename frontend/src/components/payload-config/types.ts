export interface ConnectorConfig {
  id: number;
  client_id: string;
  trigger_type: string;
  http_method: string;
  url: string;
  response_mapping?: string | null;
  headers_template?: string | null;
  request_template?: string | null;
  auth_type: string;
  auth_field_name?: string | null;
  payload_encoding?: 'plain' | 'base64_query';
  base64_query_param_name?: string | null;
  oauth_token_url?: string;
  oauth_client_id?: string;
  oauth_grant_type?: 'client_credentials' | 'refresh_token';
  oauth_header_prefix?: string;
  oauth_scope?: string;
  oauth_token_auth_method?: 'client_secret_post' | 'client_secret_basic';
  oauth_has_secret?: boolean;
  oauth_has_refresh_token?: boolean;
  status: 'draft' | 'pending_approval' | 'live' | 'disabled' | 'pending_deletion';
  version: number;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  requires_regex_review?: boolean;
}

export interface ConnectorFormData {
  client_id: string;
  trigger_type: string;
  custom_trigger: string;
  http_method: string;
  url: string;
  auth_type: 'bearer' | 'basic' | 'api_key_header' | 'api_key_query' | 'oauth2_client_credentials';
  auth_secret: string;
  auth_field_name: string;
  oauth_token_url: string;
  oauth_client_id: string;
  oauth_client_secret: string;
  oauth_refresh_token: string;
  oauth_grant_type: 'client_credentials' | 'refresh_token';
  oauth_header_prefix: string;
  oauth_scope: string;
  oauth_token_auth_method: 'client_secret_post' | 'client_secret_basic';
  payload_encoding: 'plain' | 'base64_query';
  base64_query_param_name: string;
  headers_template: string;
  request_template: string;
  response_mapping: string;
  status: 'draft' | 'pending_approval';
}

export interface OAuthTestResult {
  success: boolean;
  message?: string;
  error?: string;
  expires_in?: number;
  duration_ms?: number;
}

export interface AiTemplateForm {
  trigger_type: string;
  crm_schema_description: string;
  sample_response: string;
}

export interface AiTemplateResult {
  request_template?: any;
  response_mapping?: any;
  error?: string;
}

export interface AllowlistItem {
  id: number;
  scheme: string;
  netloc: string;
  path: string;
  created_at: string;
}

export const CONTEXT_VARS = [
  '{{client_id}}',
  '{{from_email}}',
  '{{subject}}',
  '{{body}}',
  '{{cleaned_body}}',
  '{{ticket_id}}',
  '{{intent}}',
  '{{sentiment}}',
  '{{priority}}',
];

export const defaultFormData: ConnectorFormData = {
  client_id: '',
  trigger_type: 'ticket_create',
  custom_trigger: '',
  http_method: 'POST',
  url: '',
  auth_type: 'bearer',
  auth_secret: '',
  auth_field_name: '',
  oauth_token_url: '',
  oauth_client_id: '',
  oauth_client_secret: '',
  oauth_refresh_token: '',
  oauth_grant_type: 'client_credentials',
  oauth_header_prefix: 'Bearer',
  oauth_scope: '',
  oauth_token_auth_method: 'client_secret_post',
  payload_encoding: 'plain',
  base64_query_param_name: 'data',
  headers_template: '{\n  "Content-Type": "application/json"\n}',
  request_template: '{\n  "client_id": "{{client_id}}",\n  "mail_id": "{{from_email}}",\n  "subject": "{{subject}}",\n  "body": "{{body}}",\n  "priority_name": "{{priority}}"\n}',
  response_mapping: '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "Refrence_No",\n      "extract_regex": null\n    }\n  ]\n}',
  status: 'pending_approval',
};
