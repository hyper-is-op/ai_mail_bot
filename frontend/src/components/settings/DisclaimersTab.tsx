import React from 'react';
import { 
  ShieldAlert, 
  Cpu, 
  Loader2, 
  ToggleRight, 
  ToggleLeft, 
  Sparkles, 
  Plus, 
  Trash2 
} from 'lucide-react';
import { FeaturesState, DisclaimerItem, PRESET_DISCLAIMERS } from './types';

interface DisclaimersTabProps {
  targetClientId: string;
  features: FeaturesState;
  stripDisclaimerToggling: boolean;
  handleToggleStripDisclaimers: () => void;
  newDisclaimerText: string;
  setNewDisclaimerText: (val: string) => void;
  disclaimerSaving: boolean;
  handleAddDisclaimer: (e: React.FormEvent) => void;
  disclaimerLoading: boolean;
  disclaimers: DisclaimerItem[];
  handleToggleDisclaimer: (id: number, currentStatus: boolean) => void;
  handleDeleteDisclaimer: (id: number) => void;
}

export const DisclaimersTab: React.FC<DisclaimersTabProps> = ({
  targetClientId,
  features,
  stripDisclaimerToggling,
  handleToggleStripDisclaimers,
  newDisclaimerText,
  setNewDisclaimerText,
  disclaimerSaving,
  handleAddDisclaimer,
  disclaimerLoading,
  disclaimers,
  handleToggleDisclaimer,
  handleDeleteDisclaimer,
}) => {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white">Email Disclaimer &amp; Boilerplate Rules</h3>
              <p className="text-xs text-zinc-400">
                Define custom email disclaimer phrases, legal signatures, and enterprise confidentiality notices that will be collapsed in UI and stripped before AI processing.
              </p>
            </div>
          </div>
        </div>

        {/* AI / LLM Prompt Protection Toggle Banner */}
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shrink-0 mt-0.5">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-foreground">
                  Strip Disclaimers &amp; Boilerplates from AI / LLM Prompts
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Token Saver
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${features.feature_strip_disclaimers ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-500/15 text-muted-foreground'}`}>
                  {features.feature_strip_disclaimers ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-2xl">
                Automatically removes legal boilerplate, confidentiality footers, and active disclaimer phrases from email bodies before sending to LLM prompts, Intent Detection, and RAG search. Reduces token consumption and prevents AI hallucinations.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={stripDisclaimerToggling || !targetClientId || targetClientId === 'ALL'}
            onClick={handleToggleStripDisclaimers}
            className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer disabled:opacity-50"
            title={targetClientId === 'ALL' ? 'Select a specific client to change setting' : 'Toggle Disclaimer Stripping for AI'}
          >
            {stripDisclaimerToggling ? (
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            ) : features.feature_strip_disclaimers ? (
              <ToggleRight className="w-8 h-8 text-emerald-500" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Add New Disclaimer Form */}
        <form onSubmit={handleAddDisclaimer} className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Add Custom Disclaimer / Signature Pattern
          </label>
          <textarea
            required
            rows={3}
            placeholder="Paste the disclaimer text, confidentiality notice, or legal signature to collapse..."
            value={newDisclaimerText}
            onChange={(e) => setNewDisclaimerText(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-primary leading-relaxed"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Preset Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-semibold">Presets:</span>
              {PRESET_DISCLAIMERS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNewDisclaimerText(preset.text)}
                  className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-zinc-300 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                  {preset.title}
                </button>
              ))}
            </div>

            <button
              disabled={disclaimerSaving}
              type="submit"
              className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1 hover:bg-primary/90 transition-all shadow-sm self-end"
            >
              {disclaimerSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save Disclaimer Rule
            </button>
          </div>
        </form>

        {/* Disclaimers Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configured Disclaimer Rules</h4>
          {disclaimerLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : disclaimers.length > 0 ? (
            <div className="space-y-3">
              {disclaimers.map((item) => (
                <div 
                  key={item.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-white/20 transition-all"
                >
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.client_id === 'GLOBAL' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                        {item.client_id === 'GLOBAL' ? '🌐 Global Rule' : `Client: ${item.client_id}`}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
                        {item.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-zinc-300 leading-relaxed line-clamp-2">
                      {item.disclaimer_text}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => handleToggleDisclaimer(item.id, item.is_active)}
                      className={`p-2 rounded-lg border transition-colors ${item.is_active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}
                      title={item.is_active ? 'Disable Rule' : 'Enable Rule'}
                    >
                      {item.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDisclaimer(item.id)}
                      className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-white/10 rounded-xl">
              No custom disclaimers configured yet. Built-in defaults are actively used.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
