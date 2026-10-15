import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { BaseModal } from '@/components/common';
import { AiTemplateForm, AiTemplateResult } from './types';

interface AiTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiForm: AiTemplateForm;
  setAiForm: React.Dispatch<React.SetStateAction<AiTemplateForm>>;
  aiGenerating: boolean;
  aiResult: AiTemplateResult | null;
  onGenerateAiPreview: (e: React.FormEvent) => void;
  onApplyAiResult: () => void;
}

export const AiTemplateModal: React.FC<AiTemplateModalProps> = ({
  isOpen,
  onClose,
  aiForm,
  setAiForm,
  aiGenerating,
  aiResult,
  onGenerateAiPreview,
  onApplyAiResult,
}) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      icon={<Sparkles className="w-5 h-5" />}
      iconContainerClassName="bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
      title="AI Connector Template Generator"
      subtitle="Describe your CRM schema and let the LLM generate the JSON mappings."
    >
      <div className="p-6 space-y-4">
        <form onSubmit={onGenerateAiPreview} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-foreground">Trigger Type</label>
            <select
              value={aiForm.trigger_type}
              onChange={(e) => setAiForm({ ...aiForm, trigger_type: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-border bg-secondary/40 text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ticket_create" className="bg-card">ticket_create (Ticket Generation)</option>
              <option value="ticket_status" className="bg-card">ticket_status (Support Ticket Lookup)</option>
              <option value="order_status" className="bg-card">order_status (Order Status Tracking)</option>
              <option value="payment_status" className="bg-card">payment_status (Payment &amp; Invoice Status)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Target CRM / API Description</label>
            <textarea
              value={aiForm.crm_schema_description}
              onChange={(e) => setAiForm({ ...aiForm, crm_schema_description: e.target.value })}
              rows={3}
              required
              placeholder="e.g. A ticketing REST API that takes JSON with 'subject', 'body', 'user_email', and 'severity'. Returns a JSON object with 'Refrence_No' for the created ticket id."
              className="w-full p-3 rounded-lg border border-border bg-secondary/40 text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Sample CRM Response (Optional)</label>
            <textarea
              value={aiForm.sample_response}
              onChange={(e) => setAiForm({ ...aiForm, sample_response: e.target.value })}
              rows={3}
              placeholder='e.g. {"status": "success", "ticket": {"id": "T-12345", "status": "Open"}}'
              className="w-full p-3 rounded-lg border border-border bg-secondary/40 text-foreground font-mono text-[11px] outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={aiGenerating}
              className="px-5 py-2.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Generate Template Preview</span>
            </button>
          </div>
        </form>

        {aiResult && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            {aiResult.error ? (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                {aiResult.error}
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                  ✨ Template preview drafted successfully! Review below and apply to connector form.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <div className="font-sans font-semibold mb-1 text-muted-foreground">Draft Request Template</div>
                    <pre className="overflow-x-auto max-h-36 scrollbar-thin text-foreground">
                      {JSON.stringify(aiResult.request_template, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <div className="font-sans font-semibold mb-1 text-muted-foreground">Draft Response Mapping</div>
                    <pre className="overflow-x-auto max-h-36 scrollbar-thin text-foreground">
                      {JSON.stringify(aiResult.response_mapping, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onApplyAiResult}
                    className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-sm text-xs"
                  >
                    Use in Connector Form
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
};

export default AiTemplateModal;

