import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  ExternalLink, 
  ToggleRight, 
  ToggleLeft 
} from 'lucide-react';

interface PauseDraftTabProps {
  targetClientId: string;
  autoSendEnabled: boolean;
  onToggleAutoSend: (targetVal: boolean) => void;
}

export const PauseDraftTab: React.FC<PauseDraftTabProps> = ({
  targetClientId,
  autoSendEnabled,
  onToggleAutoSend,
}) => {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-white/5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white">Pause &amp; Draft Configuration</h3>
              <p className="text-xs text-muted-foreground">
                Control automated dispatching and human-in-the-loop email review queue for {targetClientId}.
              </p>
            </div>
          </div>

          <Link
            to="/drafts"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <span>Open Pause &amp; Draft Queue</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Main Mode Toggle Card */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-bold text-foreground">
                Pause &amp; Draft Mode
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${
                !autoSendEnabled
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              }`}>
                {!autoSendEnabled ? 'Pause & Draft Active' : 'Direct Auto-Send'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {!autoSendEnabled
                ? "Active: All generated AI replies are safely paused and placed into the Pause & Draft queue for manual operator review, editing, and approval before sending via SMTP."
                : "Disabled (Direct Auto-Send): Confident AI replies (≥ confidence threshold) bypass the draft queue and are dispatched automatically via SMTP without human inspection."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleAutoSend(!autoSendEnabled)}
            className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer"
            title={!autoSendEnabled ? "Click to switch to Direct Auto-Send" : "Click to switch to Pause & Draft"}
          >
            {!autoSendEnabled ? (
              <ToggleRight className="w-10 h-10 text-amber-500" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            )}
          </button>
        </div>

        {/* Step-by-Step Workflow Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.01] space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">1</span>
              <span>Inbound AI Analysis</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Incoming customer emails are evaluated using RAG knowledge bases, sentiment analysis, and confidence scoring.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.01] space-y-2">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-[10px]">2</span>
              <span>Draft Review &amp; Quality</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              In Pause &amp; Draft mode, replies wait for human inspection. Agents can tweak phrasing, verify answers, and check attachments.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.01] space-y-2">
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px]">3</span>
              <span>Batch or Single Dispatch</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Send drafts individually, in custom batches, or discard unwanted responses with full CRM tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
