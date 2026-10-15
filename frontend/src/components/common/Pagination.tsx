import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  loading?: boolean;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  totalCount,
  totalPages: propTotalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  loading = false,
  className,
}) => {
  const calculatedPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const totalPages = propTotalPages !== undefined && propTotalPages > 0 ? propTotalPages : calculatedPages;
  const startRecord = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-card/50 text-xs text-muted-foreground",
        className
      )}
    >
      {/* Left: Page Size Selector & Counter */}
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-card border border-border text-foreground rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors shadow-2xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-card text-foreground">
                  {opt}
                </option>
              ))}
            </select>
          </>
        )}
        <span className="font-medium text-foreground/80 ml-1">
          Showing {startRecord.toLocaleString()} to {endRecord.toLocaleString()} of {totalCount.toLocaleString()} records
        </span>
      </div>

      {/* Right: Previous / Next Navigation */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-secondary text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs active:scale-[0.98]"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>
        <span className="px-2 font-mono text-[11px] text-foreground font-semibold">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-secondary text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs active:scale-[0.98]"
          title="Next page"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
