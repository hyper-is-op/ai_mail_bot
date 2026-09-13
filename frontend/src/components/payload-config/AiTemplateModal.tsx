import React from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 pb-4 border-b border-zinc-200 dark:border-white/10 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">AI Connector Template Generator</h3>
              <p className="text-xs text-muted-foreground">
                Describe your CRM schema and let the LLM generate the JSON mappings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
          <form onSubmit={onGenerateAiPreview} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold block mb-1">Trigger Type</label>
              <select
                value={aiForm.trigger_type}
                onChange={(e) => setAiForm({ ...aiForm, trigger_type: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-transparent outline-none"
              >
                <option value="ticket_create" className="dark:bg-zinc-900">ticket_create (Ticket Generation)</option>
                <option value="order_status" className="dark:bg-zinc-900">order_status (Status Lookup)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Target CRM / API Description</label>
              <textarea
                value={aiForm.crm_schema_description}
                onChange={(e) => setAiForm({ ...aiForm, crm_schema_description: e.target.value })}
                rows={3}
                required
                placeholder="e.g. A ticketing REST API that takes JSON with 'subject', 'body', 'user_email', and 'severity'. Returns a JSON object with 'Refrence_No' for the created ticket id."
                className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/30 outline-none"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Sample CRM Response (Optional)</label>
              <textarea
                value={aiForm.sample_response}
                onChange={(e) => setAiForm({ ...aiForm, sample_response: e.target.value })}
                rows={3}
                placeholder='e.g. {"status": "success", "ticket": {"id": "T-12345", "status": "Open"}}'
                className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/30 font-mono text-[11px] outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={aiGenerating}
                className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition-all flex items-center gap-2 cursor-pointer"
              >
                {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Template Preview
              </button>
            </div>
          </form>

          {aiResult && (
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-white/10 space-y-4">
              {aiResult.error ? (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                  {aiResult.error}
                </div>
              ) : (
                <>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs">
                    ✨ Template preview drafted successfully! Review below and apply to connector form.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                    <div className="p-3 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5">
                      <div className="font-sans font-semibold mb-1 text-muted-foreground">Draft Request Template</div>
                      <pre className="overflow-x-auto max-h-36 scrollbar-thin">
                        {JSON.stringify(aiResult.request_template, null, 2)}
                      </pre>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5">
                      <div className="font-sans font-semibold mb-1 text-muted-foreground">Draft Response Mapping</div>
                      <pre className="overflow-x-auto max-h-36 scrollbar-thin">
                        {JSON.stringify(aiResult.response_mapping, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={onApplyAiResult}
                      className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all cursor-pointer"
                    >
                      Use in Connector Form
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiTemplateModal;
