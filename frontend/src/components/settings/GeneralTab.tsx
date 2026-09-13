import React from 'react';
import { 
  Power, 
  Lock, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  Unlock, 
  Gauge, 
  UserCheck, 
  Sparkles, 
  Save 
} from 'lucide-react';
import { AGENT_PERSONAS, TONE_OPTIONS, MasterBotStatus } from './types';

interface GeneralTabProps {
  selectedClientId: string;
  threshold: number;
  setThreshold: (val: number) => void;
  tone: string;
  setTone: (val: string) => void;
  agentType: string;
  setAgentType: (val: string) => void;
  masterBotStatus: MasterBotStatus;
  masterBotLoading: boolean;
  masterBotToggling: boolean;
  isAdmin: boolean;
  requestKillSwitchToggle: (type: 'client' | 'admin', enable: boolean) => void;
  handleSave: (e: React.FormEvent) => void;
  saving: boolean;
  success: boolean;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  selectedClientId,
  threshold,
  setThreshold,
  tone,
  setTone,
  agentType,
  setAgentType,
  masterBotStatus,
  masterBotLoading,
  masterBotToggling,
  isAdmin,
  requestKillSwitchToggle,
  handleSave,
  saving,
  success,
}) => {
  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Card 0: Master Automation Flow Control (Kill Switch) */}
      {selectedClientId !== 'ALL' && (
        <div className={`p-6 rounded-2xl border transition-all ${
          !masterBotStatus.admin_bot_enabled
            ? 'bg-rose-500/10 border-rose-500/30 dark:bg-rose-950/20 dark:border-rose-500/30'
            : !masterBotStatus.client_bot_enabled
            ? 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20 dark:border-amber-500/30'
            : 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-950/10 dark:border-emerald-500/20 glass-panel'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className={`p-3 rounded-xl shrink-0 ${
                !masterBotStatus.admin_bot_enabled
                  ? 'bg-rose-500/20 text-rose-500'
                  : !masterBotStatus.client_bot_enabled
                  ? 'bg-amber-500/20 text-amber-500'
                  : 'bg-emerald-500/20 text-emerald-500'
              }`}>
                <Power className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Master Kill Switch (All Flow Control)</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                    !masterBotStatus.admin_bot_enabled
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      : !masterBotStatus.client_bot_enabled
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {!masterBotStatus.admin_bot_enabled ? (
                      <>
                        <Lock className="w-3 h-3" /> Admin Kill Active (Halted)
                      </>
                    ) : !masterBotStatus.client_bot_enabled ? (
                      <>
                        <Clock className="w-3 h-3" /> Client Kill Active (Halted)
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Flow Active &amp; Running
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  {!masterBotStatus.admin_bot_enabled
                    ? '⛔ System Administrator has engaged the Master Kill Switch for this account. All Gmail reading, background tasks, auto-replies, and ticket creations are completely stopped.'
                    : !masterBotStatus.client_bot_enabled
                    ? '⏸️ Master Kill Switch is ENGAGED. All incoming email polling and bot processing are completely stopped. Emails remain unread in Gmail.'
                    : '⚡ All bot operations are actively running: background polling, AI classification, draft generation, and auto-dispatch.'}
                </p>
              </div>
            </div>

            {/* Controls based on role & admin lock */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0 self-end sm:self-auto">
              {/* Client Toggle */}
              <button
                type="button"
                disabled={masterBotLoading || masterBotToggling || !masterBotStatus.admin_bot_enabled}
                onClick={() => requestKillSwitchToggle('client', !masterBotStatus.client_bot_enabled)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:cursor-not-allowed ${
                  !masterBotStatus.admin_bot_enabled
                    ? 'opacity-50 bg-zinc-200 dark:bg-white/10 text-zinc-400 border border-zinc-300 dark:border-white/10'
                    : masterBotStatus.client_bot_enabled
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
                title={!masterBotStatus.admin_bot_enabled ? 'Locked by Administrator. Only an admin can re-enable.' : ''}
              >
                {masterBotToggling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : !masterBotStatus.admin_bot_enabled ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : masterBotStatus.client_bot_enabled ? (
                  <Power className="w-3.5 h-3.5" />
                ) : (
                  <Power className="w-3.5 h-3.5" />
                )}
                <span>
                  {!masterBotStatus.admin_bot_enabled
                    ? 'Locked by Admin'
                    : masterBotStatus.client_bot_enabled
                    ? 'Engage Kill Switch (Stop All)'
                    : 'Disengage Kill Switch (Resume All)'}
                </span>
              </button>

              {/* Admin Override Action */}
              {isAdmin && (
                <button
                  type="button"
                  disabled={masterBotLoading || masterBotToggling}
                  onClick={() => requestKillSwitchToggle('admin', !masterBotStatus.admin_bot_enabled)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    masterBotStatus.admin_bot_enabled
                      ? 'border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {masterBotStatus.admin_bot_enabled ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Admin Force Kill</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Admin Unlock</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card 1: AI Confidence Evaluation & Threshold Slider */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white">AI Confidence Score Threshold</h3>
              <p className="text-xs text-zinc-400">
                Minimum RAG answer quality score required to automatically dispatch an email reply without human escalation.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-2xl font-black ${
              threshold >= 85 ? 'text-emerald-400' :
              threshold >= 70 ? 'text-blue-400' :
              'text-amber-400'
            }`}>
              {threshold}%
            </span>
            <span className="block text-[10px] uppercase font-bold text-muted-foreground">
              {threshold >= 85 ? 'Strict Quality (Conservative)' :
               threshold >= 70 ? 'Balanced (Recommended)' :
               'Lenient (High Automation)'}
            </span>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {/* Relative container for accurately positioned stop labels */}
          <div className="relative h-6 text-[11px] font-semibold text-muted-foreground select-none">
            <button
              type="button"
              onClick={() => setThreshold(50)}
              className={`absolute left-0 text-left transition-colors cursor-pointer hover:text-foreground ${threshold === 50 ? 'text-primary font-bold' : ''}`}
            >
              50% <span className="hidden sm:inline font-normal text-[10px]">(More Replies)</span>
            </button>
            <button
              type="button"
              onClick={() => setThreshold(70)}
              className={`absolute left-[44.44%] -translate-x-1/2 text-center transition-colors cursor-pointer hover:text-foreground ${threshold === 70 ? 'text-primary font-bold' : ''}`}
            >
              70% <span className="hidden sm:inline font-normal text-[10px]">(Balanced)</span>
            </button>
            <button
              type="button"
              onClick={() => setThreshold(80)}
              className={`absolute left-[66.67%] -translate-x-1/2 text-center transition-colors cursor-pointer hover:text-foreground ${threshold === 80 ? 'text-primary font-bold' : ''}`}
            >
              80% <span className="hidden sm:inline font-normal text-[10px]">(Standard)</span>
            </button>
            <button
              type="button"
              onClick={() => setThreshold(95)}
              className={`absolute right-0 text-right transition-colors cursor-pointer hover:text-foreground ${threshold === 95 ? 'text-primary font-bold' : ''}`}
            >
              95% <span className="hidden sm:inline font-normal text-[10px]">(High Precision)</span>
            </button>
          </div>

          {/* Slider Input */}
          <div className="relative flex items-center">
            <input
              type="range"
              min="50"
              max="95"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary z-10"
            />
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
            When the LLM confidence score is <strong>≥ {threshold}%</strong>, the system executes automated SMTP delivery. If score falls below <strong>{threshold}%</strong>, the message is automatically escalated to the support desk as a ticket.
          </p>
        </div>
      </div>

      {/* Persona & Tone are ONLY shown for individual clients, NOT for ALL Clients (Global) */}
      {selectedClientId !== 'ALL' && (
        <>
          {/* Card 2: Agent Persona / Role (Choice Chips) */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">Agent Persona / Role</h3>
                <p className="text-xs text-zinc-400">Select the domain role injected into the LLM system prompt to shape reply knowledge and framing.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {AGENT_PERSONAS.map((persona) => {
                const isSelected = agentType === persona.id;
                const IconComponent = persona.icon;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => setAgentType(persona.id)}
                    className={`relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-foreground shadow-sm shadow-primary/10 ring-1 ring-primary'
                        : 'bg-white/5 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-foreground'}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-foreground">{persona.name}</span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {persona.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 3: Response Tone Style (Choice Chips) */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">Response Tone Style</h3>
                <p className="text-xs text-zinc-400">Select the customer-facing brand tone for phrasing and vocabulary.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {TONE_OPTIONS.map((item) => {
                const isSelected = tone === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTone(item.id)}
                    className={`relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-foreground shadow-sm shadow-primary/10 ring-1 ring-primary'
                        : 'bg-white/5 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">{item.name}</span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-primary-foreground text-xs font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {success ? 'Configuration Saved!' : (selectedClientId === 'ALL' ? 'Save Global Threshold' : 'Save System Configuration')}
        </button>
      </div>
    </form>
  );
};
