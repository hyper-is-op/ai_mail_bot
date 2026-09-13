import React from 'react';
import { 
  Sparkles, 
  ToggleRight, 
  ToggleLeft, 
  Loader2, 
  Save 
} from 'lucide-react';
import { FeaturesState } from './types';

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
    <form onSubmit={handleSaveFeatures} className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm space-y-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100 dark:border-white/5">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white">AI Automation Features &amp; Modules</h3>
            <p className="text-xs text-muted-foreground">
              Enable or disable specialized autonomous capabilities and integration workflows for {targetClientId}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Feature 1: Ticket Creation */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-foreground">Helpdesk Ticket Creation</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Automatically generate tickets and incident references in external CRM when inquiries require human escalation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFeatures(prev => ({ ...prev, feature_ticket_creation: !prev.feature_ticket_creation }))}
              className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer pt-0.5"
            >
              {features.feature_ticket_creation ? (
                <ToggleRight className="w-8 h-8 text-primary" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Feature 2: Knowledge Base RAG */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-foreground">Knowledge Base (RAG) Lookup</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Perform semantic search across company documents, FAQs, and product knowledge to ground AI responses.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFeatures(prev => ({ ...prev, feature_rag: !prev.feature_rag }))}
              className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer pt-0.5"
            >
              {features.feature_rag ? (
                <ToggleRight className="w-8 h-8 text-primary" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Feature 3: Tools / Order Tracking */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-foreground">System Connector &amp; Tool Invocation</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Execute live API webhooks for dynamic lookups, order tracking, and external CRM updates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFeatures(prev => ({ ...prev, feature_order_tracking: !prev.feature_order_tracking }))}
              className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer pt-0.5"
            >
              {features.feature_order_tracking ? (
                <ToggleRight className="w-8 h-8 text-primary" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Feature 4: Manual Reply */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-foreground">Human-in-the-Loop Manual Reply</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Allow support operators to review, edit, and manually send generated drafts from the Inbox interface.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFeatures(prev => ({ ...prev, feature_manual_reply: !prev.feature_manual_reply }))}
              className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer pt-0.5"
            >
              {features.feature_manual_reply ? (
                <ToggleRight className="w-8 h-8 text-primary" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Feature 5: Email Disclaimer & Boilerplate Stripping */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">AI Disclaimer & Boilerplate Stripping</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Token Saver
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Strip confidentiality notices, legal footers, and active disclaimer phrases from email bodies before AI processing to save prompt tokens and improve response quality.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFeatures(prev => ({ ...prev, feature_strip_disclaimers: !prev.feature_strip_disclaimers }))}
              className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer pt-0.5"
            >
              {features.feature_strip_disclaimers ? (
                <ToggleRight className="w-8 h-8 text-primary" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={featuresSaving}
            className="bg-primary text-primary-foreground text-xs font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {featuresSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{success ? 'Features Saved!' : 'Save Feature Modules'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
