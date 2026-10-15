import { BASE_URL, authHeaders, safeJson } from './core';

export const analyticsApi = {
  async getDashboardStats(clientId: string, rangeType: string = "all", startDate?: string, endDate?: string) {
    let url = `${BASE_URL}/dashboard-stats/${clientId}?range_type=${rangeType}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    const res = await fetch(url, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch dashboard stats');
  },

  async uploadRagData(data: { client_id: string; title: string; content: string }) {
    const res = await fetch(`${BASE_URL}/rag/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to upload RAG data');
  },

  async getRagDocuments(clientId: string) {
    const res = await fetch(`${BASE_URL}/rag/documents/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch RAG documents');
  },

  async deleteRagDocument(clientId: string, docId: string) {
    const res = await fetch(`${BASE_URL}/rag/documents/${clientId}/${docId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete RAG document');
  },

  async queryRag(data: { client_id: string; query: string }) {
    const res = await fetch(`${BASE_URL}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to query RAG');
  },

  async retrieveRag(data: { client_id: string; query: string; top_k?: number }) {
    const res = await fetch(`${BASE_URL}/rag/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to retrieve RAG documents');
  },

  async uploadRagFile(clientId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('client_id', clientId);
    const res = await fetch(`${BASE_URL}/rag/upload-file`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return safeJson(res, 'Failed to upload file');
  },

  async getAdminKnowledgeStats() {
    const res = await fetch(`${BASE_URL}/admin/knowledge-stats`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch knowledge stats');
  },

  async getNotifications(clientId: string) {
    const res = await fetch(`${BASE_URL}/notifications/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch notifications');
  },

  async getTicketingReport(
    clientId: string,
    params: {
      range_type?: string;
      start_date?: string;
      end_date?: string;
      intent?: string;
      resolution_mode?: string;
      escalation_reason?: string;
      search?: string;
      search_field?: string;
      page?: number;
      page_size?: number;
    } = {}
  ): Promise<TicketingReportResponse> {
    const query = new URLSearchParams();
    if (params.range_type) query.set('range_type', params.range_type);
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.intent && params.intent !== 'all') query.set('intent', params.intent);
    if (params.resolution_mode && params.resolution_mode !== 'all') query.set('resolution_mode', params.resolution_mode);
    if (params.escalation_reason && params.escalation_reason !== 'all') query.set('escalation_reason', params.escalation_reason);
    if (params.search) query.set('search', params.search);
    if (params.search_field && params.search_field !== 'all') query.set('search_field', params.search_field);
    if (params.page) query.set('page', params.page.toString());
    if (params.page_size) query.set('page_size', params.page_size.toString());

    const res = await fetch(`${BASE_URL}/reports/ticketing/${clientId}?${query.toString()}`, {
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to fetch ticketing report');
  },

  async downloadReportCsv(
    clientId: string,
    params: {
      range_type?: string;
      start_date?: string;
      end_date?: string;
      intent?: string;
      resolution_mode?: string;
      escalation_reason?: string;
      search?: string;
      search_field?: string;
    } = {}
  ) {
    const query = new URLSearchParams();
    if (params.range_type) query.set('range_type', params.range_type);
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.intent && params.intent !== 'all') query.set('intent', params.intent);
    if (params.resolution_mode && params.resolution_mode !== 'all') query.set('resolution_mode', params.resolution_mode);
    if (params.escalation_reason && params.escalation_reason !== 'all') query.set('escalation_reason', params.escalation_reason);
    if (params.search) query.set('search', params.search);
    if (params.search_field && params.search_field !== 'all') query.set('search_field', params.search_field);

    const res = await fetch(`${BASE_URL}/reports/export/${clientId}?${query.toString()}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to export CSV report');
    return res.blob();
  },
};

export interface InboundHealth {
  total_inbound: number;
  real_inquiries: number;
  marketing_count: number;
  spam_count?: number;
  blocked_count: number;
  bounce_count: number;
  bounce_rate: number;
  delivery_health_score: number;
  avg_daily_inbound?: number;
  monthly_inbound_volume?: number;
  hourly_profile?: Array<{ hour: number; count: number }>;
}

export interface ExecutionLatency {
  total_execution_ms: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  first_action?: {
    avg_ms: number;
    min_ms: number;
    max_ms: number;
  };
}

export interface IntentMatrixItem {
  intent: string;
  total_volume: number;
  auto_sent_count: number;
  auto_sent_rate: number;
  ticket_count: number;
  escalation_rate: number;
  avg_turns: number;
  primary_escalation_reason: string;
}

export interface IngestionHealth {
  worker_heartbeat: {
    status: 'healthy' | 'delayed' | 'stalled' | 'standby' | 'offline' | 'unknown';
    last_seen_sec?: number | null;
    label: string;
  };
  queue_depth: number;
  oldest_pending_sec: number;
  client_sync?: {
    last_sync_sec?: number | null;
    status: string;
  } | null;
}

export interface ConversationalPerformance {
  customer_resolution_rate: number;
  rag_resolved_count: number;
  ticket_escalated_count: number;
  fcr_count?: number;
  fcr_rate?: number;
  multi_turn_count?: number;
  runaway_risk_count?: number;
  avg_resolution_turns: number;
  avg_resolution_duration_sec: number;
  completed_conversations?: {
    count: number;
    avg_duration_sec: number;
    min_duration_sec: number;
    max_duration_sec: number;
  };
  incomplete_conversations?: {
    count: number;
    total_duration_sec: number;
    avg_duration_sec: number;
    min_duration_sec: number;
    max_duration_sec: number;
  };
  rag_resolution_timing?: {
    count: number;
    avg_duration_sec: number;
    min_duration_sec: number;
    max_duration_sec: number;
  };
  ticket_escalation_timing?: {
    count: number;
    avg_duration_sec: number;
    min_duration_sec: number;
    max_duration_sec: number;
  };
  active_wip_conversations: number;
  avg_active_wip_age_sec: number;
  active_wip_aging?: {
    under_1h: number;
    warning_1_4h: number;
    breached_over_4h: number;
  };
  sentiment_trajectory: {
    improved: number;
    neutral_stable: number;
    deteriorated: number;
  };
  sentiment_distribution?: {
    positive: number;
    neutral: number;
    negative: number;
    net_score: number;
  };
  inferred_csat: number;
  intent_breakdown: Array<{ intent: string; count: number }>;
  intent_matrix?: IntentMatrixItem[];
}

export interface TicketingReportRecord {
  id: number;
  thread_id: string;
  timestamp: string;
  customer_email: string;
  subject: string;
  summary_of_issue: string;
  technical_intent: string;
  resolution_mode: string;
  status: string;
  escalation_reason?: string | null;
  total_turns: number;
  confidence_score: number;
  sentiment: string;
  sentiment_shift: string;
  sentiment_score: number;
  estimated_cost: number;
  raw_cost?: number;
  billed_cost?: number;
  margin?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  latency_ms?: number;
  latency_sec?: number;
}

export interface TicketingReportResponse {
  status: string;
  client_id: string;
  summary: {
    total_records: number;
    rag_deflected: number;
    tickets_created: number;
    manual_reviews: number;
    deflection_rate: number;
    avg_confidence: number;
  };
  pagination: {
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
  };
  records: TicketingReportRecord[];
}
export interface TokenEconomicsPerEmail {
  total_emails: number;
  total_cost: number;
  avg_cost: number;
  min_cost: number;
  max_cost: number;
  total_tokens: number;
  avg_tokens: number;
  min_tokens: number;
  max_tokens: number;
  api_invocations: {
    total: number;
    avg_per_mail: number;
    min_per_mail: number;
    max_per_mail: number;
  };
}

export interface ConversationEconomicsDetail {
  total_count: number;
  total_cost: number;
  avg_cost: number;
  min_cost: number;
  max_cost: number;
  total_tokens: number;
  avg_tokens: number;
  min_tokens: number;
  max_tokens: number;
  avg_turns: number;
  min_turns: number;
  max_turns: number;
  avg_api_invocations: number;
  min_api_invocations: number;
  max_api_invocations: number;
  runaway_risk_count?: number;
}

export interface BudgetStatusData {
  budget: number | null;
  spent: number;
  spent_tokens?: number;
  percent: number | null;
  status: 'unlimited' | 'ok' | 'warning' | 'exceeded';
  turnover_type?: string;
  turnover_reset_date?: string;
  days_until_reset?: number;
  daily_avg_consumption?: {
    avg_cost: number;
    min_cost: number;
    max_cost: number;
    avg_tokens: number;
    min_tokens: number;
    max_tokens: number;
  };
  projected_month_end_spend?: number;
}

export interface TokenEconomicsData {
  per_email?: TokenEconomicsPerEmail;
  completed_conversations?: ConversationEconomicsDetail;
  incomplete_conversations?: ConversationEconomicsDetail;
  avg_cost_per_email: number;
  avg_tokens_per_email: number;
  avg_cost_per_conversation: number;
  avg_tokens_per_conversation: number;
  avg_turns_per_conversation: number;
  total_conversations: number;
  guardrail_overhead_ratio: number;
  economics_by_intent: Array<{
    intent: string;
    conversations: number;
    total_tokens: number;
    total_cost: number;
    avg_cost: number;
  }>;
}
