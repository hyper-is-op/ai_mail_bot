import React from 'react';
import {
  CheckSquare,
  Square,
  RefreshCw,
  FileText,
  User,
  Calendar,
  Clock,
  CheckCircle,
  Trash2,
  Edit3,
  Send,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DraftItem } from './types';

interface DraftsTableProps {
  drafts: DraftItem[];
  loading: boolean;
  statusFilter: string;
  selectedIds: number[];
  onToggleSelectAll: () => void;
  onToggleSelectOne: (id: number) => void;
  onOpenReview: (draft: DraftItem) => void;
  onSendSingle: (id: number) => void;
  onDiscardSingle: (id: number) => void;
  actionLoading: boolean;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  totalCount: number;
}

export const DraftsTable: React.FC<DraftsTableProps> = ({
  drafts,
  loading,
  statusFilter,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectOne,
  onOpenReview,
  onSendSingle,
  onDiscardSingle,
  actionLoading,
  page,
  setPage,
  totalPages,
  totalCount,
}) => {
  return (
    <div className="rounded-lg win11-card overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-black/[0.02] dark:bg-white/[0.03] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-black/[0.06] dark:border-white/[0.06]">
            <tr>
              <th className="p-3.5 w-10">
                <button
                  type="button"
                  onClick={onToggleSelectAll}
                  className="flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {drafts.length > 0 && selectedIds.length === drafts.length ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="p-3.5 font-semibold">Sender &amp; Customer</th>
              <th className="p-3.5 font-semibold">Subject &amp; AI Draft Snippet</th>
              <th className="p-3.5 font-semibold">Intent / Quality</th>
              <th className="p-3.5 font-semibold">Status</th>
              <th className="p-3.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                  Loading drafts...
                </td>
              </tr>
            ) : drafts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-2.5 opacity-40 text-foreground" />
                  <p className="text-sm font-semibold text-foreground">No drafts found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {statusFilter === 'pending'
                      ? 'All caught up! No drafts currently waiting for review.'
                      : 'No records matching the selected status or filters.'}
                  </p>
                </td>
              </tr>
            ) : (
              drafts.map((draft) => {
                const isSelected = selectedIds.includes(draft.id);
                const isPending = draft.status === 'pending';

                return (
                  <tr
                    key={draft.id}
                    className={`hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors ${
                      isSelected ? 'bg-primary/10 dark:bg-primary/15' : ''
                    }`}
                  >
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => onToggleSelectOne(draft.id)}
                        className="flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        {draft.sender_name || draft.from_email.split('@')[0]}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{draft.from_email}</div>
                      <div className="text-[10px] text-muted-foreground/80 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(draft.created_at).toLocaleString()}
                      </div>
                    </td>

                    <td className="p-3.5 max-w-md">
                      <div className="font-medium text-foreground truncate">
                        {draft.subject}
                      </div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 font-mono bg-black/[0.03] dark:bg-white/[0.04] p-1.5 rounded border border-black/[0.05] dark:border-white/[0.05]">
                        {draft.draft_reply}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="flex flex-col gap-1">
                        {draft.intent && (
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-medium bg-black/[0.05] dark:bg-white/[0.08] text-foreground">
                            {draft.intent}
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <div className="w-14 bg-black/[0.08] dark:bg-white/[0.1] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                draft.confidence_score >= 80
                                  ? 'bg-emerald-500'
                                  : draft.confidence_score >= 60
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${draft.confidence_score}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-foreground">
                            {draft.confidence_score}%
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      {draft.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      ) : draft.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" />
                          Dispatched
                        </span>
                      ) : draft.status === 'discarded' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20">
                          <Trash2 className="w-3 h-3" />
                          Discarded
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground">
                          {draft.status}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenReview(draft)}
                          className="p-1.5 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Inspect & Edit Draft"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => onSendSingle(draft.id)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-md hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Send Now"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDiscardSingle(draft.id)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-md hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Discard Draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded border border-black/[0.08] dark:border-white/[0.08] disabled:opacity-40 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded border border-black/[0.08] dark:border-white/[0.08] disabled:opacity-40 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
