export interface DraftItem {
  id: number;
  client_id: string;
  email_log_id?: number;
  from_email: string;
  sender_name?: string;
  to_email: string;
  subject: string;
  original_body: string;
  draft_reply: string;
  confidence_score: number;
  intent?: string;
  sentiment?: string;
  priority?: string;
  ticket_id?: string;
  in_reply_to?: string;
  message_id?: string;
  status: 'pending' | 'approved' | 'sent' | 'rejected' | 'discarded' | 'sending';
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  sent_at?: string;
  created_at: string;
}

export interface DraftMetrics {
  total: number;
  pending: number;
  sent: number;
  discarded: number;
  avg_confidence: number;
}
