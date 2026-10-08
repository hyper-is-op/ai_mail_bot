import React from 'react';
import { 
  Loader2, 
  Save,
  Ticket,
  Database,
  Code2,
  MessageSquare,
  FileCheck2,
  Clock,
  Webhook,
  Send,
  ShieldAlert,
  Bell
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
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
  const [testingWebhook, setTestingWebhook] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; msg: string } | null>(null);

  const handleTestWebhook = async () => {
    if (!features.webhook_url?.trim()) {
      setTestResult({ ok: false, msg: 'Enter a webhook URL first.' });
      return;
    }
    setTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await api.testAlertWebhook({
        client_id: targetClientId,
        webhook_url: features.webhook_url.trim(),
        alert_sla_hours: features.alert_sla_hours || 4,
        alert_on_sla_breach: features.alert_on_sla_breach,
        alert_on_worker_stall: features.alert_on_worker_stall,
      });
      setTestResult({ ok: true, msg: res.message || 'Test alert delivered!' });
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || 'Delivery failed' });
    } finally {
      setTestingWebhook(false);
    }
  };
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

        {/* Feature 6: Conversation Inactivity Timeout */}
        <SettingsRow
          icon={Clock}
          title="Conversation Inactivity Timeout"
          description="Hours before an idle conversation is automatically marked closed. Replies received after this cutoff launch a fresh thread while preserving prior deflection metrics."
          action={
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={720}
                value={features.inactivity_timeout_hours ?? 72}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setFeatures((prev) => ({
                    ...prev,
                    inactivity_timeout_hours: isNaN(val) ? 72 : Math.max(1, Math.min(720, val))
                  }));
                }}
                className="w-20 px-2 py-1 text-xs text-right font-mono font-medium rounded-md border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/80 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground font-medium">hours</span>
            </div>
          }
        />
      </SettingsCard>

      {/* Proactive Sentinel Webhooks & SLA Alerts */}
      <SettingsCard
        title="Proactive Sentinel Webhooks & SLA Alerts"
        description="Configure automated outbound notifications to Slack, Discord, or generic webhook endpoints when operational incidents or SLA breaches occur."
      >
        <SettingsRow
          icon={Webhook}
          title="Outbound Alert Webhook URL"
          description="Destination endpoint for real-time notifications. Supports Slack incoming webhooks, Discord channels, and generic JSON listeners."
          action={
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 w-full max-w-md">
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={features.webhook_url || ''}
                onChange={(e) => setFeatures((prev) => ({ ...prev, webhook_url: e.target.value }))}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/80 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={testingWebhook || !features.webhook_url?.trim()}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-foreground transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {testingWebhook ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                <span>Test Ping</span>
              </button>
            </div>
          }
        />
        {testResult && (
          <div className="px-5 py-2">
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded",
              testResult.ok ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10"
            )}>
              {testResult.msg}
            </span>
          </div>
        )}

        <SettingsRow
          icon={ShieldAlert}
          title="Alert on Ingestion Worker Stalls"
          description="Fire immediate high-priority alerts if the Celery worker heartbeat ceases or queue processing lag exceeds 300 seconds."
          action={
            <FluentToggle
              checked={features.alert_on_worker_stall ?? true}
              onChange={(val) => setFeatures((prev) => ({ ...prev, alert_on_worker_stall: val }))}
              aria-label="Alert on Ingestion Worker Stalls"
            />
          }
        />

        <SettingsRow
          icon={Bell}
          title="Alert on Conversation SLA Breaches"
          description="Send proactive notification when active, unclosed customer inquiries remain unresolved beyond the SLA threshold."
          action={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={features.alert_sla_hours ?? 4}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setFeatures((prev) => ({
                      ...prev,
                      alert_sla_hours: isNaN(val) ? 4 : Math.max(1, Math.min(72, val))
                    }));
                  }}
                  className="w-16 px-2 py-1 text-xs text-right font-mono font-medium rounded-md border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/80 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground font-medium">hrs</span>
              </div>
              <FluentToggle
                checked={features.alert_on_sla_breach ?? true}
                onChange={(val) => setFeatures((prev) => ({ ...prev, alert_on_sla_breach: val }))}
                aria-label="Alert on Conversation SLA Breaches"
              />
            </div>
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
