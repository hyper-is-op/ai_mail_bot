import { ConnectorFormData } from './types';

export interface ConnectorPreset {
  id: string;
  title: string;
  provider: 'Zoho' | 'Freshdesk' | 'Zendesk' | 'Shopify';
  category: 'CRM' | 'E-Commerce';
  trigger_type: 'ticket_create' | 'ticket_status' | 'order_status';
  description: string;
  placeholders: string[];
  config: Partial<ConnectorFormData>;
}

export const CONNECTOR_PRESETS: ConnectorPreset[] = [
  // ── Zoho Desk (Ticket Create) ─────────────────────────────────────────────
  {
    id: 'zoho_desk_ticket_create',
    title: 'Zoho Desk (Ticket Create)',
    provider: 'Zoho',
    category: 'CRM',
    trigger_type: 'ticket_create',
    description: 'Creates a formal support ticket in Zoho Desk via OAuth2 refresh token.',
    placeholders: ['YOUR_ZOHO_ORG_ID', 'YOUR_DEPARTMENT_ID'],
    config: {
      trigger_type: 'ticket_create',
      http_method: 'POST',
      url: 'https://desk.zoho.in/api/v1/tickets',
      auth_type: 'oauth2_client_credentials',
      oauth_grant_type: 'refresh_token',
      oauth_header_prefix: 'Zoho-oauthtoken',
      oauth_token_url: 'https://accounts.zoho.in/oauth/v2/token',
      oauth_scope: 'Desk.tickets.CREATE,Desk.tickets.READ',
      headers_template: '{\n  "orgId": "YOUR_ZOHO_ORG_ID",\n  "Content-Type": "application/json"\n}',
      request_template: '{\n  "subject": "{{subject}}",\n  "description": "<div style=\\"white-space: pre-wrap; font-family: inherit;\\">=== EXECUTIVE SUMMARY ===\\n\\n{{history_summary}}\\n\\n===================================\\nTHREAD CONVERSATION LOG\\n===================================\\n\\n{{conversation_history}}</div>",\n  "departmentId": "YOUR_DEPARTMENT_ID",\n  "priority": "{{priority}}",\n  "contact": {\n    "email": "{{from_email}}",\n    "firstName": "{{first_name}}",\n    "lastName": "{{last_name}}"\n  }\n}',
      response_mapping: '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "id",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "status",\n      "extract_regex": null\n    }\n  ]\n}',
      owner_email_path: 'contact.email',
      id_pattern_regex: '^\\d{16,19}$',
    },
  },

  // ── Zoho Desk (Ticket Status Lookup) ──────────────────────────────────────
  {
    id: 'zoho_desk_ticket_status',
    title: 'Zoho Desk (Ticket Status)',
    provider: 'Zoho',
    category: 'CRM',
    trigger_type: 'ticket_status',
    description: 'Retrieves ticket status and docket details from Zoho Desk by ticket ID.',
    placeholders: ['YOUR_ZOHO_ORG_ID'],
    config: {
      trigger_type: 'ticket_status',
      http_method: 'GET',
      url: 'https://desk.zoho.in/api/v1/tickets/{{ticket_id}}',
      auth_type: 'oauth2_client_credentials',
      oauth_grant_type: 'refresh_token',
      oauth_header_prefix: 'Zoho-oauthtoken',
      oauth_token_url: 'https://accounts.zoho.in/oauth/v2/token',
      oauth_scope: 'Desk.tickets.READ',
      headers_template: '{\n  "orgId": "YOUR_ZOHO_ORG_ID",\n  "Content-Type": "application/json"\n}',
      request_template: '{}',
      response_mapping: '{\n  "fields": [\n    {\n      "field": "docket_no",\n      "path": "ticketNumber || data[0].ticketNumber",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "status || data[0].status",\n      "extract_regex": null\n    }\n  ]\n}',
      owner_email_path: 'email || contact.email',
      id_pattern_regex: '^\\d{16,19}$',
    },
  },

  // ── Freshdesk (Ticket Create) ─────────────────────────────────────────────
  {
    id: 'freshdesk_ticket_create',
    title: 'Freshdesk (Ticket Create)',
    provider: 'Freshdesk',
    category: 'CRM',
    trigger_type: 'ticket_create',
    description: 'Creates a new support ticket in Freshdesk with full multi-turn conversation history.',
    placeholders: ['YOUR_DOMAIN', 'YOUR_FRESHDESK_API_KEY'],
    config: {
      trigger_type: 'ticket_create',
      http_method: 'POST',
      url: 'https://YOUR_DOMAIN.freshdesk.com/api/v2/tickets',
      auth_type: 'basic',
      auth_secret: '{\n  "username": "YOUR_FRESHDESK_API_KEY",\n  "password": "X"\n}',
      headers_template: '{\n  "Content-Type": "application/json"\n}',
      request_template: '{\n  "subject": "{{subject}}",\n  "description": "=== EXECUTIVE SUMMARY ===\\n\\n{{history_summary}}\\n\\n===================================\\nTHREAD CONVERSATION LOG\\n===================================\\n\\n{{conversation_history}}",\n  "email": "{{from_email}}",\n  "name": "{{customer_name}}",\n  "priority": "{{priority_num}}",\n  "status": 2,\n  "tags": ["mail_ai_escalation"]\n}',
      response_mapping: '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "id",\n      "extract_regex": null\n    }\n  ]\n}',
      owner_email_path: 'email',
      id_pattern_regex: '^\\d{1,10}$',
    },
  },

  // ── Freshdesk (Ticket Status Lookup) ──────────────────────────────────────
  {
    id: 'freshdesk_ticket_status',
    title: 'Freshdesk (Ticket Status)',
    provider: 'Freshdesk',
    category: 'CRM',
    trigger_type: 'ticket_status',
    description: 'Looks up ticket status, status code, and docket details from Freshdesk.',
    placeholders: ['YOUR_DOMAIN', 'YOUR_FRESHDESK_API_KEY'],
    config: {
      trigger_type: 'ticket_status',
      http_method: 'GET',
      url: 'https://YOUR_DOMAIN.freshdesk.com/api/v2/tickets/{{ticket_id}}',
      auth_type: 'basic',
      auth_secret: '{\n  "username": "YOUR_FRESHDESK_API_KEY",\n  "password": "X"\n}',
      headers_template: '{\n  "Content-Type": "application/json"\n}',
      request_template: '{}',
      response_mapping: '{\n  "fields": [\n    {\n      "field": "docket_no",\n      "path": "id",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "status",\n      "extract_regex": null\n    }\n  ]\n}',
      owner_email_path: 'email',
      id_pattern_regex: '^\\d{1,10}$',
    },
  },

  // ── Zendesk (Ticket Create) ───────────────────────────────────────────────
  {
    id: 'zendesk_ticket_create',
    title: 'Zendesk (Ticket Create)',
    provider: 'Zendesk',
    category: 'CRM',
    trigger_type: 'ticket_create',
    description: 'Generates a support ticket in Zendesk Support API v2 with customer context.',
    placeholders: ['YOUR_SUBDOMAIN', 'YOUR_EMAIL', 'YOUR_API_TOKEN'],
    config: {
      trigger_type: 'ticket_create',
      http_method: 'POST',
      url: 'https://YOUR_SUBDOMAIN.zendesk.com/api/v2/tickets.json',
      auth_type: 'basic',
      auth_secret: '{\n  "username": "YOUR_EMAIL/token",\n  "password": "YOUR_API_TOKEN"\n}',
      headers_template: '{\n  "Content-Type": "application/json"\n}',
      request_template: '{\n  "ticket": {\n    "subject": "{{subject}}",\n    "comment": {\n      "body": "=== EXECUTIVE SUMMARY ===\\n\\n{{history_summary}}\\n\\n===================================\\nTHREAD CONVERSATION LOG\\n===================================\\n\\n{{conversation_history}}"\n    },\n    "requester": {\n      "email": "{{from_email}}",\n      "name": "{{customer_name}}"\n    },\n    "priority": "{{priority_lower}}",\n    "external_id": "{{thread_id}}",\n    "tags": ["mail_ai_escalation"]\n  }\n}',
      response_mapping: '{\n  "fields": [\n    {\n      "field": "ticket_id",\n      "path": "ticket.id",\n      "extract_regex": null\n    }\n  ]\n}',
      owner_email_path: 'ticket.requester.email',
      id_pattern_regex: '^\\d{1,10}$',
    },
  },

  // ── Zendesk (Ticket Status Lookup) ────────────────────────────────────────
  {
    id: 'zendesk_ticket_status',
    title: 'Zendesk (Ticket Status)',
    provider: 'Zendesk',
    category: 'CRM',
    trigger_type: 'ticket_status',
    description: 'Retrieves ticket status, requester email, and docket numbers from Zendesk.',
    placeholders: ['YOUR_SUBDOMAIN', 'YOUR_EMAIL', 'YOUR_API_TOKEN'],
    config: {
      trigger_type: 'ticket_status',
      http_method: 'GET',
      url: 'https://YOUR_SUBDOMAIN.zendesk.com/api/v2/tickets/{{ticket_id}}.json',
      auth_type: 'basic',
      auth_secret: '{\n  "username": "YOUR_EMAIL/token",\n  "password": "YOUR_API_TOKEN"\n}',
      headers_template: '{\n  "Content-Type": "application/json"\n}',
      request_template: '{}',
      response_mapping: '{\n  "fields": [\n    {\n      "field": "docket_no",\n      "path": "ticket.id",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "ticket.status",\n      "extract_regex": null\n    }\n  ]\n}',
      owner_email_path: 'ticket.requester.email',
      id_pattern_regex: '^\\d{1,10}$',
    },
  },

  // ── Shopify (Order Status Lookup) ─────────────────────────────────────────
  {
    id: 'shopify_order_status',
    title: 'Shopify (Order Lookup)',
    provider: 'Shopify',
    category: 'E-Commerce',
    trigger_type: 'order_status',
    description: 'Queries Shopify Admin REST API 2026-10 for order fulfillment and financial status.',
    placeholders: ['YOUR_STORE', 'YOUR_SHOPIFY_ADMIN_API_ACCESS_TOKEN'],
    config: {
      trigger_type: 'order_status',
      http_method: 'GET',
      url: 'https://YOUR_STORE.myshopify.com/admin/api/2026-10/orders.json',
      auth_type: 'api_key_header',
      auth_field_name: 'X-Shopify-Access-Token',
      auth_secret: 'YOUR_SHOPIFY_ADMIN_API_ACCESS_TOKEN',
      headers_template: '{\n  "Content-Type": "application/json"\n}',
      request_template: '{\n  "name": "{{order_id}}"\n}',
      response_mapping: '{\n  "fields": [\n    {\n      "field": "docket_no",\n      "path": "orders[0].name",\n      "extract_regex": null\n    },\n    {\n      "field": "ticket_status",\n      "path": "orders[0].fulfillment_status || orders[0].financial_status",\n      "extract_regex": null\n    }\n  ]\n}',
      owner_email_path: 'orders[0].email || orders[0].customer.email',
      id_pattern_regex: '^#?\\d{4,8}$',
    },
  },
];

/**
 * Scans form data for unedited placeholder strings (e.g. YOUR_DOMAIN, YOUR_ORG_ID).
 * Returns array of detected placeholder names.
 */
export function detectUnfilledPlaceholders(formData: ConnectorFormData): string[] {
  const combinedText = [
    formData.url,
    formData.headers_template,
    formData.request_template,
    formData.auth_secret,
    formData.oauth_token_url,
    formData.oauth_client_id,
  ].join(' ');

  const matches = combinedText.match(/\b(YOUR_[A-Z0-9_]+)\b/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}
