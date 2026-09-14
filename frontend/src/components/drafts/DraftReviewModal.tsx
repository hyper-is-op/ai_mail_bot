import React from 'react';
import {
  FileText,
  X,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Trash2,
  Send,
} from 'lucide-react';
import { DraftItem } from './types';

interface DraftReviewModalProps {
  activeDraft: DraftItem | null;
  onClose: () => void;
  editSubject: string;
  setEditSubject: (val: string) => void;
  editBody: string;
  setEditBody: (val: string) => void;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  actionLoading: boolean;
  onDiscardSingle: (id: number) => void;
  onSaveDraftChanges: () => Promise<void>;
  onSendSingle: (id: number) => Promise<void>;
}

export const DraftReviewModal: React.FC<DraftReviewModalProps> = ({
  activeDraft,
  onClose,
  editSubject,
  setEditSubject,
  editBody,
  setEditBody,
  isEditing,
  setIsEditing,
  actionLoading,
  onDiscardSingle,
  onSaveDraftChanges,
  onSendSingle,
}) => {
  if (!activeDraft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#2C2C2C] rounded-lg shadow-2xl border border-black/[0.1] dark:border-white/[0.1] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                Draft Review #{activeDraft.id}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    activeDraft.status === 'pending'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : activeDraft.status === 'sent'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/15 text-red-600 dark:text-red-400'
                  }`}
                >
                  {activeDraft.status.toUpperCase()}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                To: {activeDraft.from_email} • Confidence: {activeDraft.confidence_score}%
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Split View */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Left Column: Original Customer Email Context */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Incoming Customer Message
              </h4>
              {activeDraft.intent && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-black/[0.04] dark:bg-white/[0.08] text-foreground">
                  Intent: {activeDraft.intent}
                </span>
              )}
            </div>

            <div className="p-3.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-black/[0.2] space-y-2">
              <div className="text-muted-foreground">
                <strong className="text-foreground">From:</strong> {activeDraft.from_email}
              </div>
              <div className="text-muted-foreground">
                <strong className="text-foreground">Subject:</strong> {activeDraft.subject}
              </div>
              {activeDraft.ticket_id && (
                <div className="text-primary font-semibold">
                  Ticket ID: {activeDraft.ticket_id}
                </div>
              )}
              <hr className="border-black/[0.06] dark:border-white/[0.06] my-2" />
              <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                {activeDraft.original_body}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] text-muted-foreground space-y-1">
              <div className="flex items-center justify-between">
                <span>Sentiment:</span>
                <strong className="text-foreground">{activeDraft.sentiment || 'Neutral'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Created:</span>
                <span>{new Date(activeDraft.created_at).toLocaleString()}</span>
              </div>
              {activeDraft.reviewed_by && (
                <div className="flex items-center justify-between">
                  <span>Reviewed By:</span>
                  <span>{activeDraft.reviewed_by}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Generated Reply (Editable) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Generated Response
              </h4>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {activeDraft.confidence_score}% Confidence
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => {
                    setEditSubject(e.target.value);
                    setIsEditing(true);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Reply Body (Markdown &amp; Plain Text)
                </label>
                <textarea
                  rows={10}
                  value={editBody}
                  onChange={(e) => {
                    setEditBody(e.target.value);
                    setIsEditing(true);
                  }}
                  className="w-full p-2.5 text-xs font-mono rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-white/[0.05] text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary leading-relaxed shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            {activeDraft.status === 'pending' && (
              <button
                type="button"
                onClick={() => onDiscardSingle(activeDraft.id)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-red-600 dark:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Discard Draft
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={onSaveDraftChanges}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.04] dark:bg-white/[0.08] text-foreground hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            )}

            {activeDraft.status === 'pending' ? (
              <button
                type="button"
                onClick={async () => {
                  if (isEditing) {
                    await onSaveDraftChanges();
                  }
                  await onSendSingle(activeDraft.id);
                }}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {actionLoading ? 'Dispatching...' : 'Approve & Send Now'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-black/[0.06] dark:bg-white/[0.08] text-foreground cursor-pointer hover:opacity-80"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
