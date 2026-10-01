import React from 'react';
import { 
  Loader2, 
  Save,
  Ticket,
  Database,
  Code2,
  MessageSquare,
  FileCheck2
} from 'lucide-react';
import { FeaturesState } from './types';
import { SettingsCard, SettingsRow, FluentToggle } from '@/components/fluent';

interface FeaturesTabProps {
  targetClientId: string;
  features: FeaturesState;
  setFeatures: React.Dispatch<React.SetStateAction<FeaturesState>>;
  handleSaveFeatures: (e: React.FormEvent) => void;
  featuresSaving: boolean;
  success: boolean;
}

export const FeaturesTab: React.FC<FeaturesTabProps> = ({
  targetClientId,
  features,
  setFeatures,
  handleSaveFeatures,
  featuresSaving,
  success,
}) => {
  return (
    <form onSubmit={handleSaveFeatures} className="space-y-4">
      <SettingsCard
        title="AI Automation Features & Modules"
        description={`Enable or disable specialized autonomous capabilities and integration workflows for ${targetClientId}.`}
      >
        {/* Feature 1: Ticket Creation */}
        <SettingsRow
          icon={Ticket}
          title="Helpdesk Ticket Creation"
          description="Automatically generate tickets and incident references in external CRM when inquiries require human escalation."
          action={
            <FluentToggle
              checked={features.feature_ticket_creation}
              onChange={(val) => setFeatures((prev) => ({ ...prev, feature_ticket_creation: val }))}
              aria-label="Helpdesk Ticket Creation"
            />
          }
        />

        {/* Feature 2: Knowledge Base RAG */}
        <SettingsRow
          icon={Database}
          title="Knowledge Base (RAG) Lookup"
          description="Perform semantic search across company documents, FAQs, and product knowledge to ground AI responses."
          action={
            <FluentToggle
              checked={features.feature_rag}
              onChange={(val) => setFeatures((prev) => ({ ...prev, feature_rag: val }))}
              aria-label="Knowledge Base (RAG) Lookup"
            />
          }
        />

        {/* Feature 3: Tools / Order Tracking */}
        <SettingsRow
          icon={Code2}
          title="System Connector & Tool Invocation"
          description="Execute live API webhooks for dynamic lookups, order tracking, and external CRM updates."
          action={
            <FluentToggle
              checked={features.feature_order_tracking}
              onChange={(val) => setFeatures((prev) => ({ ...prev, feature_order_tracking: val }))}
              aria-label="System Connector & Tool Invocation"
            />
          }
        />

        {/* Feature 4: Manual Reply */}
        <SettingsRow
          icon={MessageSquare}
          title="Human-in-the-Loop Manual Reply"
          description="Allow support operators to review, edit, and manually send generated drafts from the Inbox interface."
          action={
            <FluentToggle
              checked={features.feature_manual_reply}
              onChange={(val) => setFeatures((prev) => ({ ...prev, feature_manual_reply: val }))}
              aria-label="Human-in-the-Loop Manual Reply"
            />
          }
        />

        {/* Feature 5: Email Disclaimer & Boilerplate Stripping */}
        <SettingsRow
          icon={FileCheck2}
          title="AI Disclaimer & Boilerplate Stripping"
          description="Strip confidentiality notices, legal footers, and active disclaimer phrases from email bodies before AI processing."
          action={
            <FluentToggle
              checked={features.feature_strip_disclaimers}
              onChange={(val) => setFeatures((prev) => ({ ...prev, feature_strip_disclaimers: val }))}
              aria-label="AI Disclaimer Stripping"
            />
          }
        />
      </SettingsCard>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={featuresSaving}
          className="bg-primary text-primary-foreground text-xs font-semibold px-5 py-2 rounded-md flex items-center gap-2 hover:bg-primary/90 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
        >
          {featuresSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{success ? 'Features Saved!' : 'Save Feature Modules'}</span>
        </button>
      </div>
    </form>
  );
};
