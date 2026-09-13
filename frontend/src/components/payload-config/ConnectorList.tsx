import React, { useState } from 'react';
import {
  Layers,
  RefreshCw,
  Loader2,
  Code2,
  Globe,
  Lock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit3,
  Trash2,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { ConnectorConfig } from './types';

interface ConnectorListProps {
  connectors: ConnectorConfig[];
  loading: boolean;
  isAdmin: boolean;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (config: ConnectorConfig) => void;
  onTakedownLive: (config: ConnectorConfig) => void;
  onShowDeleteModal: (config: ConnectorConfig) => void;
  onApprove: (config: ConnectorConfig) => void;
  onReject: (configId: number) => void;
  onApproveDeletion: (config: ConnectorConfig) => void;
  onRejectDeletion: (config: ConnectorConfig) => void;
  onCancelDeletionRequest: (config: ConnectorConfig) => void;
}

export const ConnectorList: React.FC<ConnectorListProps> = ({
  connectors,
  loading,
  isAdmin,
  onRefresh,
  onOpenCreate,
  onOpenEdit,
  onTakedownLive,
  onShowDeleteModal,
  onApprove,
  onReject,
  onApproveDeletion,
  onRejectDeletion,
  onCancelDeletionRequest,
}) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-card overflow-hidden">
      <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex justify-between items-center bg-zinc-50/50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-base">Configured Endpoints</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/10 text-muted-foreground">
            {connectors.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5 transition-all"
          title="Refresh List"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm">Loading connector configurations...</p>
        </div>
      ) : connectors.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-white/5">
            <Code2 className="w-8 h-8 text-muted-foreground/60" />
          </div>
          <p className="font-medium text-sm text-foreground">No connectors configured yet</p>
          <p className="text-xs max-w-sm">
            Create a new connector for ticket creation or order tracking, or use the AI Generator to draft templates.
          </p>
          <button
            type="button"
            onClick={onOpenCreate}
            className="mt-2 text-xs font-semibold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            Add First Connector
          </button>
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-white/5">
          {connectors.map((config) => {
            const isExpanded = expandedId === config.id;
            return (
              <div key={config.id} className="p-5 hover:bg-zinc-50/50 dark:hover:bg-white/[0.01] transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold border border-primary/20">
                        {config.trigger_type}
                      </span>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-white/10">
                        {config.http_method}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                          config.status === 'live'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : config.status === 'pending_approval'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse'
                            : config.status === 'pending_deletion'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse'
                            : config.status === 'draft'
                            ? 'bg-zinc-500/10 border-zinc-500/20 text-zinc-600 dark:text-zinc-400'
                            : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {config.status === 'live'
                          ? '● Live'
                          : config.status === 'pending_approval'
                          ? '⏳ Pending Approval'
                          : config.status === 'pending_deletion'
                          ? '🗑️ Deletion Requested'
                          : config.status === 'draft'
                          ? 'Draft'
                          : 'Disabled'}
                      </span>
                      <span className="text-xs text-muted-foreground">v{config.version}</span>
                      {config.requires_regex_review && (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 border border-orange-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          Regex Review Needed
                        </span>
                      )}
                      {isAdmin && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-muted-foreground">
                          Client: {config.client_id}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs text-foreground/90 truncate">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{config.url}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Auth: {config.auth_type}
                      </span>
                      <span>Created: {new Date(config.created_at).toLocaleDateString()}</span>
                      {config.approved_by && (
                        <span>Approved by: {config.approved_by}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : config.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {isExpanded ? 'Hide Specs' : 'View Specs'}
                    </button>

                    {config.status !== 'pending_deletion' && (
                      <button
                        type="button"
                        onClick={() => onOpenEdit(config)}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {config.status === 'live' ? 'Edit Version' : 'Edit'}
                      </button>
                    )}

                    {/* Live Takedown / Delete */}
                    {config.status === 'live' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onTakedownLive(config)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-amber-500/20 text-amber-600 hover:bg-amber-500/10 transition-all flex items-center gap-1 cursor-pointer"
                          title={isAdmin ? "Take Down Live Connector (Disable)" : "Request Admin to Take Down Live Connector"}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {isAdmin ? 'Take Down' : 'Request Takedown'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onShowDeleteModal(config)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-500/20 text-rose-600 hover:bg-rose-500/10 transition-all flex items-center gap-1 cursor-pointer"
                          title={isAdmin ? "Permanently Delete Live Connector" : "Request Admin to Delete Live Connector"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isAdmin ? 'Delete' : 'Request Delete'}
                        </button>
                      </>
                    )}

                    {/* Draft Delete */}
                    {config.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => onShowDeleteModal(config)}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-500/20 text-rose-600 hover:bg-rose-500/10 transition-all flex items-center gap-1"
                        title="Delete Draft Connector"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Draft
                      </button>
                    )}

                    {/* Pending Approval Delete */}
                    {config.status === 'pending_approval' && (
                      <button
                        type="button"
                        onClick={() => onShowDeleteModal(config)}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-500/20 text-rose-600 hover:bg-rose-500/10 transition-all flex items-center gap-1"
                        title="Delete Pending Approval Connector"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Pending
                      </button>
                    )}

                    {/* Disabled Delete / Request Delete */}
                    {config.status === 'disabled' && (
                      <button
                        type="button"
                        onClick={() => onShowDeleteModal(config)}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-500/20 text-rose-600 hover:bg-rose-500/10 transition-all flex items-center gap-1"
                        title={isAdmin ? 'Delete Disabled Connector' : 'Request Deletion of Disabled Connector'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isAdmin ? 'Delete Disabled' : 'Request Deletion'}
                      </button>
                    )}

                    {/* Pending Deletion Actions */}
                    {config.status === 'pending_deletion' && (
                      <>
                        {isAdmin ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onApproveDeletion(config)}
                              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition-all flex items-center gap-1 shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Approve Deletion
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectDeletion(config)}
                              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject Deletion
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onCancelDeletionRequest(config)}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel Request
                          </button>
                        )}
                      </>
                    )}

                    {/* Pending Approval Actions */}
                    {isAdmin && config.status === 'pending_approval' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onApprove(config)}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve Live
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(config.id)}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-600/10 text-rose-600 hover:bg-rose-600/20 border border-rose-600/20 transition-all flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-white/5 space-y-4 text-xs font-mono">
                    {config.auth_type === 'oauth2_client_credentials' && (
                      <div className="p-3.5 rounded-xl bg-primary/[0.03] border border-primary/20 space-y-2">
                        <div className="flex items-center gap-2 font-sans font-semibold text-primary">
                          <Sparkles className="w-4 h-4" />
                          <span>OAuth 2.0 Authentication Specs</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                            {config.oauth_grant_type || 'client_credentials'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                          <div>
                            <span className="text-muted-foreground font-sans block text-[10px]">Token URL:</span>
                            <span className="text-foreground font-semibold break-all">{config.oauth_token_url || '—'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-sans block text-[10px]">Client ID:</span>
                            <span className="text-foreground font-semibold break-all">{config.oauth_client_id || '—'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-sans block text-[10px]">Header Prefix / Scope:</span>
                            <span className="text-foreground font-semibold">
                              {config.oauth_header_prefix || 'Bearer'} {config.oauth_scope ? `(${config.oauth_scope})` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 space-y-2">
                        <div className="flex justify-between items-center text-muted-foreground font-sans font-semibold">
                          <span>Request Template</span>
                          <span className="text-[10px]">JSON Payload</span>
                        </div>
                        <pre className="overflow-x-auto text-[11px] text-foreground/80 max-h-48 scrollbar-thin">
                          {config.request_template || '(No template)'}
                        </pre>
                      </div>

                      <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 space-y-2">
                        <div className="flex justify-between items-center text-muted-foreground font-sans font-semibold">
                          <span>Response Mapping</span>
                          <span className="text-[10px]">JMESPath &amp; Regex</span>
                        </div>
                        <pre className="overflow-x-auto text-[11px] text-foreground/80 max-h-48 scrollbar-thin">
                          {config.response_mapping || '(No mapping)'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConnectorList;
