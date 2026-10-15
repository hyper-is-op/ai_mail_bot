import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Primitive pulsing skeleton placeholder aligned with Windows 11 Fluent dark/light palette.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-black/[0.06] dark:bg-white/[0.06]",
        className
      )}
      {...props}
    />
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  /**
   * Optional custom widths per column (e.g. ['w-14', 'w-24', 'w-36', 'w-48', 'w-20'])
   */
  columnWidths?: string[];
  /**
   * Optional alignment per column ('left' | 'center' | 'right')
   */
  alignments?: ('left' | 'center' | 'right')[];
  /**
   * Optional cell visual variant
   */
  cellTypes?: ('text' | 'badge' | 'pill' | 'button')[];
}

/**
 * Renderable <tbody> skeleton rows that preserve table layout geometry without header unmounting.
 */
export function TableSkeleton({
  rows = 5,
  columns = 8,
  columnWidths = [],
  alignments = [],
  cellTypes = [],
}: TableSkeletonProps) {
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: columns });

  return (
    <>
      {rowArray.map((_, rowIndex) => (
        <tr
          key={rowIndex}
          className="border-b border-black/[0.04] dark:border-white/[0.05] transition-colors"
        >
          {colArray.map((_, colIndex) => {
            const align = alignments[colIndex] || 'left';
            const cellType = cellTypes[colIndex] || 'text';
            const customWidth = columnWidths[colIndex];

            // Deterministic slight width jitter so text lines don't look completely mechanical
            const textWidthClass = customWidth || (
              colIndex === 0 ? 'w-16' :
              colIndex === 1 ? 'w-20' :
              colIndex === 2 ? 'w-32' :
              colIndex === 3 ? (rowIndex % 2 === 0 ? 'w-56' : 'w-40') :
              'w-24'
            );

            return (
              <td
                key={colIndex}
                className={cn(
                  "py-3.5 px-4 whitespace-nowrap",
                  align === 'center' && "text-center",
                  align === 'right' && "text-right"
                )}
              >
                <div
                  className={cn(
                    "flex items-center",
                    align === 'center' && "justify-center",
                    align === 'right' && "justify-end"
                  )}
                >
                  {cellType === 'badge' ? (
                    <Skeleton className="h-5 w-16 rounded-md" />
                  ) : cellType === 'pill' ? (
                    <Skeleton className="h-5 w-20 rounded-full" />
                  ) : cellType === 'button' ? (
                    <Skeleton className="h-7 w-16 rounded-lg" />
                  ) : (
                    <Skeleton className={cn("h-4", textWidthClass)} />
                  )}
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export interface MetricCardsSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton for top metric/KPI card grids (e.g. Dashboard & AI Processing).
 */
export function MetricCardsSkeleton({
  count = 4,
  className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
}: MetricCardsSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="win11-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <div className="mt-3">
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-2.5 w-36 rounded mt-2 opacity-70" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton placeholder for list items in the Inbox sidebar.
 */
export function ThreadListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex items-start gap-3"
        >
          <Skeleton className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
            <Skeleton className="h-3 w-40 rounded opacity-80" />
            <Skeleton className="h-2.5 w-52 rounded opacity-60" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Two-pane skeleton for the complete Inbox layout to prevent layout snapping on load.
 */
export function InboxLayoutSkeleton() {
  return (
    <div className="flex h-[calc(100vh-140px)] gap-5">
      {/* Left Sidebar Frame */}
      <div className="w-80 md:w-96 flex flex-col win11-card rounded-2xl overflow-hidden border border-white/10">
        <div className="p-3.5 border-b border-white/10 space-y-2.5">
          <Skeleton className="h-8 w-full rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ThreadListSkeleton count={7} />
        </div>
      </div>

      {/* Right Detail Frame */}
      <div className="flex-1 flex flex-col win11-card rounded-2xl overflow-hidden border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64 rounded-md" />
            <Skeleton className="h-3.5 w-40 rounded" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
        <div className="space-y-4 pt-4 flex-1">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-44 rounded" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
          <div className="flex items-start gap-3 justify-end">
            <div className="space-y-2 flex-1 max-w-xl">
              <Skeleton className="h-4 w-36 rounded ml-auto" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard skeleton holding the header stats and major chart boxes stable.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Date Filter Bar Placeholder */}
      <div className="win11-card p-2.5 px-3 rounded-lg flex items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <Skeleton className="h-7 w-32 rounded-md" />
      </div>

      {/* 4 KPI Cards */}
      <MetricCardsSkeleton count={4} />

      {/* Mid-Row Telemetry & Aging Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="win11-card p-5 rounded-2xl border border-white/10 space-y-3">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        <div className="win11-card p-5 rounded-2xl border border-white/10 space-y-3">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        <div className="win11-card p-5 rounded-2xl border border-white/10 space-y-3">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>

      {/* Lower Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="win11-card p-5 rounded-2xl border border-white/10 space-y-3">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
        <div className="win11-card p-5 rounded-2xl border border-white/10 space-y-3">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Token Economics / LLM Analytics skeleton matching /dashboard?tab=llm geometry.
 */
export function LlmAnalyticsSkeleton() {
  return (
    <div className="space-y-6 pb-12">
      {/* Header with Title and Action Button */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-56 rounded-md" />
          <Skeleton className="h-3.5 w-80 rounded" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg self-start md:self-auto" />
      </div>

      {/* Date Filter Panel */}
      <div className="win11-card p-2 px-3 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-6 w-18 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="win11-card p-5 rounded-lg space-y-3 shadow-2xs">
            <div className="flex justify-between items-start">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-3 w-36 rounded opacity-70" />
          </div>
        ))}
      </div>

      {/* Monthly Budget & Turnover Velocity Card */}
      <div className="win11-card p-5 rounded-lg shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-64 rounded-md" />
            <Skeleton className="h-3.5 w-80 rounded" />
          </div>
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] space-y-2">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-2.5 w-32 rounded opacity-70" />
            </div>
          ))}
        </div>
        <div className="space-y-1 pt-1">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-36 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      </div>

      {/* Granular Unit Economics Deck */}
      <div className="win11-card p-5 rounded-lg shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="space-y-1">
            <Skeleton className="h-5 w-72 rounded-md" />
            <Skeleton className="h-3.5 w-96 rounded" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.08] space-y-3">
            <Skeleton className="h-4 w-44 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
          <div className="p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.08] space-y-3">
            <Skeleton className="h-4 w-44 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* 14-Day Spend & Token Volume Trend Chart */}
      <div className="win11-card p-5 rounded-lg shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-60 rounded-md" />
          <Skeleton className="h-3.5 w-32 rounded" />
        </div>
        <div className="h-40 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-black/[0.06] dark:border-white/[0.08]">
          {[40, 65, 30, 85, 50, 70, 95, 45, 60, 75, 35, 90, 55, 80].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <Skeleton className="w-full max-w-[28px] rounded-t" style={{ height: `${h}%` }} />
              <Skeleton className="h-2.5 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Provider Breakdown */}
      <div className="win11-card p-5 rounded-lg shadow-2xs space-y-4">
        <Skeleton className="h-5 w-64 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-12 rounded" />
              </div>
              <Skeleton className="h-6 w-20 rounded-md" />
              <Skeleton className="h-3 w-32 rounded opacity-70" />
            </div>
          ))}
        </div>
      </div>

      {/* Granular Execution Logs Skeleton */}
      <div className="win11-card p-5 rounded-lg shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-64 rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08] text-muted-foreground pb-2">
                {['Timestamp', 'Provider', 'Subsystem Node', 'Attribution', 'Model', 'Prompt', 'Completion', 'Latency', 'Cost'].map((_, idx) => (
                  <th key={idx} className="pb-2.5">
                    <Skeleton className="h-3.5 w-14 rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <TableSkeleton columns={9} rows={5} />
          </table>
        </div>
      </div>
    </div>
  );
}

