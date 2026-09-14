import React from 'react';
import {
  Layers,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  Save,
} from 'lucide-react';
import {
  AvailFormState,
  GloballyAvailableConfig,
  PROVIDER_DEFAULT_URLS,
  PROVIDER_SAMPLE_MODELS,
} from './types';

interface GloballyAvailableTabProps {
  availForm: AvailFormState;
  setAvailForm: React.Dispatch<React.SetStateAction<AvailFormState>>;
  savingAvail: boolean;
  showAvailFormApiKey: boolean;
  setShowAvailFormApiKey: (val: boolean) => void;
  availFetchedModels: string[];
  setAvailFetchedModels: (models: string[]) => void;
  refreshingAvailForm: boolean;
  globallyAvailableConfigs: GloballyAvailableConfig[];
  refreshingAvailId: number | null;
  showApiKeyMap: Record<number, boolean>;
  setShowApiKeyMap: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onSave: (e: React.FormEvent) => void;
  onRefreshAvailForm: () => void;
  onRefreshConfig: (configId: number) => void;
  onDeleteConfig: (id: number) => void;
  onCancelEdit: () => void;
  onEditConfig: (config: GloballyAvailableConfig) => void;
}

export const GloballyAvailableTab: React.FC<GloballyAvailableTabProps> = ({
  availForm,
  setAvailForm,
  savingAvail,
  showAvailFormApiKey,
  setShowAvailFormApiKey,
  availFetchedModels,
  setAvailFetchedModels,
  refreshingAvailForm,
  globallyAvailableConfigs,
  refreshingAvailId,
  showApiKeyMap,
  setShowApiKeyMap,
  onSave,
  onRefreshAvailForm,
  onRefreshConfig,
  onDeleteConfig,
  onCancelEdit,
  onEditConfig,
}) => {
  const providerKey = availForm.provider || 'groq';
  const sampleModels = PROVIDER_SAMPLE_MODELS[providerKey] || [];
  const combinedModels = Array.from(
    new Set([availForm.model_name, ...availFetchedModels, ...sampleModels].filter(Boolean))
  );

  return (
    <div className="space-y-6">
      {/* Add / Edit Form Panel */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
              {availForm.id !== undefined
                ? '⚡ Edit Globally Available LLM Config Template'
                : '➕ Add Globally Available LLM Config Template'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define reusable provider integrations in `globally_available_llm_configs` that clients can reference across their use cases.
            </p>
          </div>
          {availForm.id !== undefined && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-xs bg-white/10 hover:bg-white/20 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Friendly Name</label>
            <input
              required
              type="text"
              placeholder="e.g. My Fast Classifier, Production Claude"
              value={availForm.name}
              onChange={(e) => setAvailForm({ ...availForm, name: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Provider Type</label>
            <select
              value={availForm.provider}
              onChange={(e) => {
                const p = e.target.value;
                setAvailForm((prev) => ({
                  ...prev,
                  provider: p,
                  base_url: PROVIDER_DEFAULT_URLS[p] || '',
                  model_name: PROVIDER_SAMPLE_MODELS[p]?.[0] || '',
                }));
                setAvailFetchedModels([]);
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors cursor-pointer"
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
            <label className="text-[10px] font-bold text-zinc-400 uppercase">API Key</label>
            <div className="relative">
              <input
                required
                type={showAvailFormApiKey ? 'text' : 'password'}
                placeholder="Provider API key"
                value={availForm.api_key}
                onChange={(e) => setAvailForm({ ...availForm, api_key: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAvailFormApiKey(!showAvailFormApiKey)}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {showAvailFormApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-400 uppercase">Default Model</label>
              {availFetchedModels.length > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {availFetchedModels.length} live models
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={availForm.model_name}
                onChange={(e) => setAvailForm({ ...availForm, model_name: e.target.value })}
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {availFetchedModels.length > 0 ? (
                  <optgroup label={`Live Fetched Models (${availFetchedModels.length})`} className="bg-zinc-900 text-primary font-bold">
                    {availFetchedModels.map((m) => (
                      <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                    ))}
                  </optgroup>
                ) : (
                  <optgroup label={`Available ${providerKey.toUpperCase()} Models`} className="bg-zinc-900 text-zinc-300 font-semibold">
                    {combinedModels.map((m) => (
                      <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={onRefreshAvailForm}
                disabled={refreshingAvailForm}
                title="Fetch live models directly from provider API"
                className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {refreshingAvailForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Base API URL</label>
            <input
              type="text"
              placeholder="e.g. https://api.groq.com/openai/v1"
              value={availForm.base_url || ''}
              onChange={(e) => setAvailForm({ ...availForm, base_url: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors font-mono text-xs"
            />
          </div>

          <div className="flex items-end justify-end md:col-span-3">
            <button
              type="submit"
              disabled={savingAvail}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {savingAvail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{availForm.id !== undefined ? 'Update Configuration' : 'Save New Configuration'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Pool List */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> Active Globally Available Templates ({globallyAvailableConfigs.length})
        </h4>

        {globallyAvailableConfigs.length === 0 ? (
          <div className="p-8 text-center glass-panel rounded-2xl border border-white/5 text-muted-foreground text-sm">
            No globally available LLM templates created yet. Add one above to allow clients to use it.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {globallyAvailableConfigs.map((c) => {
              const isRefreshing = refreshingAvailId === c.id;
              const isKeyVisible = showApiKeyMap[c.id];
              return (
                <div key={c.id} className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base">{c.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary uppercase font-bold">
                            {c.provider}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Model: <strong className="text-zinc-200">{c.model_name}</strong></p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditConfig(c)}
                          className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteConfig(c.id)}
                          className="p-1.5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>API Key:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-200">
                            {isKeyVisible ? c.api_key : `${c.api_key?.substring(0, 7)}••••••••`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowApiKeyMap((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                            className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                          >
                            {isKeyVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400 text-[11px] truncate">
                        <span>Base URL:</span>
                        <span className="text-zinc-300 truncate max-w-[180px]">{c.base_url || 'Default Provider URL'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    {c.refreshed ? (
                      <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {c.refreshed}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 italic">Never refreshed</span>
                    )}

                    <button
                      type="button"
                      onClick={() => onRefreshConfig(c.id)}
                      disabled={isRefreshing}
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
