import React from 'react';
import {
  CheckSquare,
  Square,
  FileText,
  User,
  Calendar,
  Trash2,
  Edit3,
  Send,
} from 'lucide-react';
import { DraftItem } from './types';
import { ReferenceBadge } from '@/components/common/ReferenceBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/common/Skeleton';

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
    <div className="rounded-xl win11-card border border-border overflow-hidden shadow-2xs relative">
      {loading && drafts.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/40 animate-pulse z-10" />
      )}
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
              <th className="p-3.5 font-semibold">ID</th>
              <th className="p-3.5 font-semibold">Thread ID</th>
              <th className="p-3.5 font-semibold">Sender &amp; Customer</th>
              <th className="p-3.5 font-semibold">Subject &amp; AI Draft Snippet</th>
              <th className="p-3.5 font-semibold">Intent / Quality</th>
              <th className="p-3.5 font-semibold">Status</th>
              <th className="p-3.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className={cn(
            "divide-y divide-black/[0.04] dark:divide-white/[0.05] transition-opacity",
            loading && drafts.length > 0 && "opacity-50 pointer-events-none"
          )}>
            {loading && drafts.length === 0 ? (
              <TableSkeleton
                rows={6}
                columns={8}
                alignments={['left', 'left', 'left', 'left', 'left', 'left', 'left', 'right']}
                cellTypes={['text', 'badge', 'badge', 'text', 'text', 'pill', 'pill', 'button']}
                columnWidths={['w-6', 'w-16', 'w-24', 'w-36', 'w-64', 'w-24', 'w-20', 'w-24']}
              />
            ) : drafts.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground">
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

                    {/* ID Column */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5 items-start">
                        <ReferenceBadge
                          id={draft.email_log_id ?? draft.id}
                          type="message"
                          label="#"
                          truncateLength={0}
                        />
                        {draft.email_log_id && draft.id ? (
                          <span className="text-[10px] font-mono text-muted-foreground/70">
                            Draft #{draft.id}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Thread Column */}
                    <td className="p-3.5 whitespace-nowrap">
                      <ReferenceBadge id={draft.thread_id} type="thread" truncateLength={10} />
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        {draft.sender_name || draft.from_email.split('@')[0]}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{draft.from_email}</div>
                      <div className="text-[10px] text-muted-foreground/80 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(draft.created_at).toLocaleString()}
                        </span>
                        {draft.ticket_id ? (
                          <ReferenceBadge id={draft.ticket_id} type="ticket" truncateLength={10} />
                        ) : null}
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
                        <StatusBadge variant="warning" label="Pending" dot size="xs" />
                      ) : draft.status === 'sent' ? (
                        <StatusBadge variant="success" label="Dispatched" dot size="xs" />
                      ) : draft.status === 'discarded' ? (
                        <StatusBadge variant="danger" label="Discarded" dot size="xs" />
                      ) : (
                        <StatusBadge variant="neutral" label={draft.status} dot size="xs" />
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
        <Pagination
          page={page}
          pageSize={15}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};
