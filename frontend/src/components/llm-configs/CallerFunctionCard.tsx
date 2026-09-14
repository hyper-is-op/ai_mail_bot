import React from 'react';
import {
  Globe,
  Sparkles,
  Loader2,
  RefreshCw,
  Save,
  Check,
} from 'lucide-react';
import {
  CallerFunctionDefinition,
  ClientFunctionConfig,
  GloballyAvailableConfig,
  GlobalDefaultState,
  PROVIDER_DEFAULT_URLS,
  PROVIDER_SAMPLE_MODELS,
} from './types';

interface CallerFunctionCardProps {
  fn: CallerFunctionDefinition;
  cfg: ClientFunctionConfig;
  onUpdateConfig: (updater: (prevCfg: ClientFunctionConfig) => ClientFunctionConfig) => void;
  isSaving: boolean;
  isSaved: boolean;
  onSave: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  fnFetchedModels: string[];
  globallyAvailableConfigs: GloballyAvailableConfig[];
  globalDefault: GlobalDefaultState;
  globalDefaultFetchedModels: string[];
  availActiveModelsMap: Record<number, string[]>;
}

export const CallerFunctionCard: React.FC<CallerFunctionCardProps> = ({
  fn,
  cfg,
  onUpdateConfig,
  isSaving,
  isSaved,
  onSave,
  onRefresh,
  isRefreshing,
  fnFetchedModels,
  globallyAvailableConfigs,
  globalDefault,
  globalDefaultFetchedModels,
  availActiveModelsMap,
}) => {
  const isCustomMode = cfg.mode === 'custom';

  // Mode A: Global Provider Reference computations
  const selectedTemplate = globallyAvailableConfigs.find((c) => c.id === cfg.global_config_id);
  const liveModels =
    fnFetchedModels?.length > 0
      ? fnFetchedModels
      : cfg.global_config_id && availActiveModelsMap[cfg.global_config_id]?.length
      ? availActiveModelsMap[cfg.global_config_id]
      : selectedTemplate
      ? []
      : globalDefaultFetchedModels;

  const providerKey = selectedTemplate?.provider || globalDefault.provider || 'groq';
  const suggestedModels = PROVIDER_SAMPLE_MODELS[providerKey] || [];
  const defaultFallbackModel = selectedTemplate?.model_name || globalDefault.model_name || 'qwen/qwen3.6-27b';
  const availableOptions = Array.from(
    new Set([defaultFallbackModel, cfg.model_name, ...liveModels, ...suggestedModels].filter(Boolean) as string[])
  );

  // Mode B: Dedicated Custom Provider computations
  const customLiveModels = fnFetchedModels || [];
  const customProviderKey = cfg.provider || 'groq';
  const customSuggested = PROVIDER_SAMPLE_MODELS[customProviderKey] || [];
  const customOptions = Array.from(
    new Set([cfg.model_name, ...customLiveModels, ...customSuggested].filter(Boolean) as string[])
  );

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white text-sm">{fn.label}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              {fn.key}
            </span>
            {cfg.refreshed ? (
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Refreshed: {cfg.refreshed}
              </span>
            ) : (
              <span className="text-[10px] text-zinc-500 italic bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                Never refreshed
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{fn.desc}</p>
        </div>

        {/* Mode Toggle: Global Inherit vs Custom Provider */}
        <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => onUpdateConfig((prev) => ({ ...prev, mode: 'global' }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !isCustomMode
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Global Provider</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdateConfig((prev) => ({ ...prev, mode: 'custom' }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isCustomMode
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Custom Provider</span>
          </button>
        </div>
      </div>

      {/* Mode A: Global Provider Reference */}
      {!isCustomMode ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Referenced Provider Integration</label>
            <select
              value={cfg.global_config_id || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value) : undefined;
                const sel = globallyAvailableConfigs.find((c) => c.id === val);
                onUpdateConfig((prev) => ({
                  ...prev,
                  global_config_id: val,
                  model_name: sel?.model_name || '',
                }));
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="" className="bg-zinc-900 text-zinc-300 font-bold">
                🌐 Default Global LLM Fallback ({globalDefault.provider.toUpperCase()} - {globalDefault.model_name})
              </option>
              {globallyAvailableConfigs.length > 0 && (
                <optgroup label="Globally Available Templates" className="bg-zinc-900 text-zinc-400 font-semibold">
                  {globallyAvailableConfigs.map((c) => (
                    <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                      📦 {c.name} ({c.provider.toUpperCase()} - {c.model_name})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Model Name Selection</label>
              {liveModels.length > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {liveModels.length} live models
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={cfg.model_name || ''}
                onChange={(e) => onUpdateConfig((prev) => ({ ...prev, model_name: e.target.value }))}
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="" className="bg-zinc-900 text-zinc-400">
                  🌐 (use provider default: {defaultFallbackModel})
                </option>
                {liveModels.length > 0 ? (
                  <optgroup label={`Live Fetched Models (${liveModels.length})`} className="bg-zinc-900 text-primary font-bold">
                    {liveModels.map((m) => (
                      <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                    ))}
                  </optgroup>
                ) : (
                  <optgroup label={`Available ${providerKey.toUpperCase()} Models`} className="bg-zinc-900 text-zinc-300 font-semibold">
                    {availableOptions.map((m) => (
                      <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Fetch live models from referenced provider"
                className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Mode B: Dedicated Custom Provider */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-300 uppercase">Provider Type</label>
            <select
              value={cfg.provider || 'groq'}
              onChange={(e) => {
                const p = e.target.value;
                onUpdateConfig((prev) => ({
                  ...prev,
                  provider: p,
                  base_url: PROVIDER_DEFAULT_URLS[p] || '',
                  model_name: PROVIDER_SAMPLE_MODELS[p]?.[0] || '',
                }));
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="groq" className="bg-zinc-900 text-white">Groq</option>
              <option value="openai" className="bg-zinc-900 text-white">OpenAI</option>
              <option value="claude" className="bg-zinc-900 text-white">Claude (Anthropic)</option>
              <option value="gemini" className="bg-zinc-900 text-white">Google Gemini</option>
              <option value="grok" className="bg-zinc-900 text-white">xAI (Grok)</option>
              <option value="azure" className="bg-zinc-900 text-white">Azure OpenAI</option>
              <option value="custom" className="bg-zinc-900 text-white">Custom OpenAI Gateway</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-300 uppercase">Custom API Key</label>
            <input
              type="password"
              placeholder="Client-specific API key"
              value={cfg.api_key || ''}
              onChange={(e) => onUpdateConfig((prev) => ({ ...prev, api_key: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-purple-300 uppercase">Model Name</label>
              {customLiveModels.length > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {customLiveModels.length} live models
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={cfg.model_name || ''}
                onChange={(e) => onUpdateConfig((prev) => ({ ...prev, model_name: e.target.value }))}
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="" disabled className="bg-zinc-900 text-zinc-400">-- Select Model --</option>
                {customLiveModels.length > 0 ? (
                  <optgroup label={`Live Fetched Models (${customLiveModels.length})`} className="bg-zinc-900 text-primary font-bold">
                    {customLiveModels.map((m) => (
                      <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                    ))}
                  </optgroup>
                ) : (
                  <optgroup label={`Available ${customProviderKey.toUpperCase()} Models`} className="bg-zinc-900 text-zinc-300 font-semibold">
                    {customOptions.map((m) => (
                      <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Fetch live models from custom provider"
                className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Button for Function */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            isSaved
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
          } disabled:opacity-50`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : isSaved ? (
            <>
              <Check className="w-3.5 h-3.5 font-bold" />
              <span>Saved Configuration!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save for {fn.label}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
