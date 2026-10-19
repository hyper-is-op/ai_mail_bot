# Decisions: Step 103 - Token Economics Skeleton Loader

## Problem
Visiting `/dashboard?tab=llm` (Token Economics / LLM Analytics) displayed a centered spinner:
```tsx
<div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
  <RefreshCw className="w-10 h-10 text-primary animate-spin" />
  <p className="text-sm text-zinc-400 font-medium font-mono">Compiling multi-provider token economics & latency metrics...</p>
</div>
```
This produced Cumulative Layout Shift (CLS) on initial load and when switching date ranges or clients, whereas `/dashboard` (Operations tab) and tables already have Fluent skeleton loaders.

## Technical Approach
1. **Create `LlmAnalyticsSkeleton` primitive in `components/common/Skeleton.tsx`**:
   - Matches the actual geometry of the Token Economics view:
     - Header and Sync action button skeleton
     - Date filter bar skeleton (pills + custom range placeholder)
     - 4 KPI metric cards (`MetricCardsSkeleton count={4}`)
     - Monthly Budget & Turnover Velocity card skeleton with progress bar placeholder
     - Granular Unit Economics card skeleton (per-email and WIP cards)
     - 14-Day burn trend chart box skeleton
     - Multi-provider breakdown 4-card grid skeleton
     - Model & Subsystem 2-column tables skeleton (`TableSkeleton`)
     - Granular Execution Logs & Thread Attribution table skeleton
2. **Mount `LlmAnalyticsSkeleton` on Cold Load in `LlmAnalytics.tsx`**:
   - Replace the centered `<RefreshCw className="animate-spin" />` with `<LlmAnalyticsSkeleton />`.
   - Preserve rendered cards during background refreshes (`refreshing` state) with subtle opacity reduction rather than tearing down the DOM.
