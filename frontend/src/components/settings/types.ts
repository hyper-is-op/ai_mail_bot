import { 
  Headphones, 
  Wrench, 
  CreditCard, 
  ShoppingBag, 
  Crown,
  type LucideIcon 
} from 'lucide-react';

export interface AgentPersona {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  color: string;
}

export interface ToneOption {
  id: string;
  name: string;
  desc: string;
}

export interface MasterBotStatus {
  admin_bot_enabled: boolean;
  client_bot_enabled: boolean;
  is_effective_enabled: boolean;
  is_locked_by_admin: boolean;
}

export interface KillSwitchAction {
  type: 'client' | 'admin';
  enable: boolean;
}

export interface FeaturesState {
  feature_ticket_creation: boolean;
  feature_auto_send: boolean;
  feature_rag: boolean;
  feature_order_tracking: boolean;
  feature_manual_reply: boolean;
  feature_strip_disclaimers: boolean;
}

export interface DisclaimerItem {
  id: number;
  client_id: string;
  disclaimer_text: string;
  is_active: boolean;
}

export interface PresetDisclaimer {
  title: string;
  text: string;
}

export const AGENT_PERSONAS: AgentPersona[] = [
  {
    id: 'customer_support',
    name: 'Customer Support',
    desc: 'Helpful, courteous, and solution-oriented for general inquiries.',
    icon: Headphones,
    color: 'text-blue-500'
  },
  {
    id: 'technical_support',
    name: 'Technical Support',
    desc: 'Diagnostic, analytical, and structured troubleshooting.',
    icon: Wrench,
    color: 'text-amber-500'
  },
  {
    id: 'billing_support',
    name: 'Billing & Invoicing',
    desc: 'Clear, accurate financial and payment processing guidance.',
    icon: CreditCard,
    color: 'text-emerald-500'
  },
  {
    id: 'ecommerce_support',
    name: 'E-Commerce & Orders',
    desc: 'Order tracking, delivery, product questions, and returns.',
    icon: ShoppingBag,
    color: 'text-purple-500'
  },
  {
    id: 'executive_escalation',
    name: 'Executive Escalations',
    desc: 'High-touch, prioritized VIP and sensitive issue care.',
    icon: Crown,
    color: 'text-rose-500'
  }
];

export const TONE_OPTIONS: ToneOption[] = [
  {
    id: 'Formal',
    name: 'Professional & Formal',
    desc: 'Structured, polished, and strictly courteous phrasing.'
  },
  {
    id: 'Friendly',
    name: 'Friendly & Empathetic',
    desc: 'Warm, understanding, and approachable conversational style.'
  },
  {
    id: 'Concise',
    name: 'Concise & Direct',
    desc: 'Brief, clear, and straight to the point without filler.'
  },
  {
    id: 'Casual',
    name: 'Casual & Relaxed',
    desc: 'Modern, informal, everyday conversational tone.'
  }
];

export const PRESET_DISCLAIMERS: PresetDisclaimer[] = [
  {
    title: "Towards Vision Technologies Disclaimer",
    text: "-- \n*DISCLAIMER: *This email and its attachments are confidential and intended solely for the recipient(s). Unauthorized use, disclosure, or distribution is prohibited. If you received this email in error, please notify the sender and delete it. Towards Vision Technologies Limited is not liable for any damage caused by viruses or malware in this email."
  },
  {
    title: "Standard Enterprise Confidentiality Notice",
    text: "Confidentiality Notice: This e-mail message, including any attachments, is for the sole use of the intended recipient(s) and may contain confidential and privileged information. Any unauthorized review, use, disclosure, or distribution is strictly prohibited."
  },
  {
    title: "Virus & Malware Liability Clause",
    text: "WARNING: Computer viruses can be transmitted via email. The recipient should check this email and any attachments for the presence of viruses. The company accepts no liability for any damage caused by any virus transmitted by this email."
  }
];
