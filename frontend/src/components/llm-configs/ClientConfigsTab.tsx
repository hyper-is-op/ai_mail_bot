import React from 'react';
import {
  Users,
  Layers,
  Loader2,
} from 'lucide-react';
import {
  CALLER_FUNCTIONS,
  ClientConfigsMap,
  GloballyAvailableConfig,
  GlobalDefaultState,
  ClientFunctionConfig,
} from './types';
import { CallerFunctionCard } from './CallerFunctionCard';

interface ClientConfigsTabProps {
  selectedClientId: string;
  setSelectedClientId: (clientId: string) => void;
  accounts: any[];
  clientConfigLoading: boolean;
  clientConfigs: ClientConfigsMap;
  setClientConfigs: React.Dispatch<React.SetStateAction<ClientConfigsMap>>;
  clientSavingFn: string | null;
  clientSaveSuccess: Record<string, boolean>;
  fnFetchedModels: Record<string, string[]>;
  fnFetchingModels: Record<string, boolean>;
  globallyAvailableConfigs: GloballyAvailableConfig[];
  globalDefault: GlobalDefaultState;
  globalDefaultFetchedModels: string[];
  availActiveModelsMap: Record<number, string[]>;
  onSaveFunctionConfig: (fnKey: string) => void;
  onRefreshFunction: (fnKey: string) => void;
}

const defaultFnConfig: ClientFunctionConfig = {
  mode: 'global',
  global_config_id: undefined,
  provider: 'groq',
  api_key: '',
  base_url: '',
  model_name: '',
  api_version: '',
};

export const ClientConfigsTab: React.FC<ClientConfigsTabProps> = ({
  selectedClientId,
  setSelectedClientId,
  accounts,
  clientConfigLoading,
  clientConfigs,
  setClientConfigs,
  clientSavingFn,
  clientSaveSuccess,
  fnFetchedModels,
  fnFetchingModels,
  globallyAvailableConfigs,
  globalDefault,
  globalDefaultFetchedModels,
  availActiveModelsMap,
  onSaveFunctionConfig,
  onRefreshFunction,
}) => {
  return (
    <div className="space-y-6">
      {/* Client Selection Bar */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Select Target Client</h3>
            <p className="text-xs text-muted-foreground">
              Configure AI engine parameters per use-case (stored in <code className="text-primary font-mono">client_llm_config</code>).
            </p>
          </div>
        </div>

        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors min-w-[280px] cursor-pointer"
        >
          {accounts.map((a) => (
            <option key={a.client_id} value={a.client_id} className="bg-zinc-900 text-white">
              {a.account_name} ({a.client_id})
            </option>
          ))}
        </select>
      </div>

      {clientConfigLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Use-Case AI Engine Mappings ({CALLER_FUNCTIONS.length})
            </h4>
            <span className="text-xs text-muted-foreground font-mono">Client ID: {selectedClientId}</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {CALLER_FUNCTIONS.map((fn) => {
              const cfg = clientConfigs[fn.key] || defaultFnConfig;
              return (
                <CallerFunctionCard
                  key={fn.key}
                  fn={fn}
                  cfg={cfg}
                  onUpdateConfig={(updater) =>
                    setClientConfigs((prev) => ({
                      ...prev,
                      [fn.key]: updater(prev[fn.key] || defaultFnConfig),
                    }))
                  }
                  isSaving={clientSavingFn === fn.key}
                  isSaved={!!clientSaveSuccess[fn.key]}
                  onSave={() => onSaveFunctionConfig(fn.key)}
                  onRefresh={() => onRefreshFunction(fn.key)}
                  isRefreshing={!!fnFetchingModels[fn.key]}
                  fnFetchedModels={fnFetchedModels[fn.key] || []}
                  globallyAvailableConfigs={globallyAvailableConfigs}
                  globalDefault={globalDefault}
                  globalDefaultFetchedModels={globalDefaultFetchedModels}
                  availActiveModelsMap={availActiveModelsMap}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
