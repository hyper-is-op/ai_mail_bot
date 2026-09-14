import React from 'react';
import {
  Globe,
  Shield,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  Save,
  Check,
} from 'lucide-react';
import {
  GlobalDefaultState,
  PROVIDER_DEFAULT_URLS,
  PROVIDER_SAMPLE_MODELS,
} from './types';

interface GlobalDefaultTabProps {
  globalDefault: GlobalDefaultState;
  setGlobalDefault: React.Dispatch<React.SetStateAction<GlobalDefaultState>>;
  savingGlobalDefault: boolean;
  refreshingGlobalDefault: boolean;
  showDefaultApiKey: boolean;
  setShowDefaultApiKey: (val: boolean) => void;
  globalDefaultFetchedModels: string[];
  setGlobalDefaultFetchedModels: (models: string[]) => void;
  globalDefaultSaveSuccess: boolean;
  onSave: (e: React.FormEvent) => void;
  onRefresh: () => void;
  onInitiateOverrideToggle: (targetState: boolean) => void;
}

export const GlobalDefaultTab: React.FC<GlobalDefaultTabProps> = ({
  globalDefault,
  setGlobalDefault,
  savingGlobalDefault,
  refreshingGlobalDefault,
  showDefaultApiKey,
  setShowDefaultApiKey,
  globalDefaultFetchedModels,
  setGlobalDefaultFetchedModels,
  globalDefaultSaveSuccess,
  onSave,
  onRefresh,
  onInitiateOverrideToggle,
}) => {
  const providerKey = globalDefault.provider || 'groq';
  const sampleModels = PROVIDER_SAMPLE_MODELS[providerKey] || [];
  const combinedModels = Array.from(
    new Set([globalDefault.model_name, ...globalDefaultFetchedModels, ...sampleModels].filter(Boolean))
  );

  return (
    <div className="space-y-4">
      <div className="win11-card p-5 rounded-lg space-y-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Globe className="w-4 h-4 text-primary" /> Platform Global Default LLM (`global_default_llm`)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              This single configuration acts as the platform-wide fallback AI engine whenever a client has no explicit provider or template mapped.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {globalDefault.refreshed ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Refreshed: {globalDefault.refreshed}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground italic bg-black/[0.04] dark:bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-black/[0.06] dark:border-white/[0.06]">
                Never refreshed
              </span>
            )}
          </div>
        </div>

        {/* Emergency Global Override Control Card */}
        <div
          className={`p-4 rounded-lg border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            globalDefault.is_override_active
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20'
              : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08] text-muted-foreground'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                globalDefault.is_override_active
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-black/[0.04] dark:bg-white/[0.08] text-muted-foreground border border-black/[0.06] dark:border-white/[0.08]'
              }`}
            >
              {globalDefault.is_override_active ? (
                <ShieldAlert className="w-4 h-4 animate-pulse text-rose-500" />
              ) : (
                <Shield className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-foreground">Emergency Global Override</span>
                <span
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold border ${
                    globalDefault.is_override_active
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30'
                      : 'bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground border-black/[0.06] dark:border-white/[0.08]'
                  }`}
                >
                  {globalDefault.is_override_active ? '● ACTIVE — ENFORCING GLOBAL DEFAULT' : 'INACTIVE — NORMAL ROUTING'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                When enabled, forces the entire platform to execute all AI operations through this Global Default LLM, completely overriding per-client and template configurations during outages or emergencies.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onInitiateOverrideToggle(!globalDefault.is_override_active)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs ${
              globalDefault.is_override_active
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 ring-1 ring-rose-400/50'
                : 'bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-foreground border border-black/[0.08] dark:border-white/[0.08]'
            }`}
          >
            {globalDefault.is_override_active ? (
              <>
                <ToggleRight className="w-4 h-4 text-white" />
                <span>Turn OFF Override</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                <span>Turn ON Override</span>
              </>
            )}
          </button>
        </div>

        <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Provider Type</label>
            <select
              value={globalDefault.provider}
              onChange={(e) => {
                const p = e.target.value;
                setGlobalDefault((prev) => ({
                  ...prev,
                  provider: p,
                  base_url: PROVIDER_DEFAULT_URLS[p] || '',
                  model_name: PROVIDER_SAMPLE_MODELS[p]?.[0] || '',
                }));
                setGlobalDefaultFetchedModels([]);
              }}
              className="bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary transition-colors cursor-pointer shadow-2xs"
            >
              <option value="groq" className="bg-card text-foreground">Groq (Recommended Fast)</option>
              <option value="openai" className="bg-card text-foreground">OpenAI</option>
              <option value="claude" className="bg-card text-foreground">Claude (Anthropic)</option>
              <option value="gemini" className="bg-card text-foreground">Google Gemini</option>
              <option value="grok" className="bg-card text-foreground">xAI (Grok)</option>
              <option value="azure" className="bg-card text-foreground">Azure OpenAI</option>
              <option value="custom" className="bg-card text-foreground">Custom OpenAI Gateway</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Default API Key</label>
            <div className="relative">
              <input
                required
                type={showDefaultApiKey ? 'text' : 'password'}
                placeholder="API key for platform default"
                value={globalDefault.api_key}
                onChange={(e) => setGlobalDefault((prev) => ({ ...prev, api_key: e.target.value }))}
                className="w-full bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary transition-colors pr-10 shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowDefaultApiKey(!showDefaultApiKey)}
                className="absolute right-3 top-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {showDefaultApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Default Model Selection</label>
              {globalDefaultFetchedModels.length > 0 && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {globalDefaultFetchedModels.length} live models
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={globalDefault.model_name}
                onChange={(e) => setGlobalDefault((prev) => ({ ...prev, model_name: e.target.value }))}
                className="flex-1 min-w-0 bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary transition-colors cursor-pointer shadow-2xs"
              >
                {globalDefaultFetchedModels.length > 0 ? (
                  <optgroup label={`Live Fetched Models (${globalDefaultFetchedModels.length})`} className="bg-card text-primary font-bold">
                    {globalDefaultFetchedModels.map((m) => (
                      <option key={m} value={m} className="bg-card text-foreground">{m}</option>
                    ))}
                  </optgroup>
                ) : (
                  <optgroup label={`Available ${providerKey.toUpperCase()} Models`} className="bg-card text-muted-foreground font-semibold">
                    {combinedModels.map((m) => (
                      <option key={m} value={m} className="bg-card text-foreground">{m}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshingGlobalDefault}
                title="Fetch live models directly from provider API"
                className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer shadow-2xs"
              >
                {refreshingGlobalDefault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Base API URL</label>
            <input
              type="text"
              placeholder="e.g. https://api.groq.com/openai/v1"
              value={globalDefault.base_url || ''}
              onChange={(e) => setGlobalDefault((prev) => ({ ...prev, base_url: e.target.value }))}
              className="bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary transition-colors font-mono shadow-2xs"
            />
          </div>

          <div className="flex items-end justify-end">
            <button
              type="submit"
              disabled={savingGlobalDefault}
              className={`w-full py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                globalDefaultSaveSuccess
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
              } disabled:opacity-50`}
            >
              {savingGlobalDefault ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Global Default...</span>
                </>
              ) : globalDefaultSaveSuccess ? (
                <>
                  <Check className="w-4 h-4 font-bold" />
                  <span>Saved Global Default!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Global Default</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
