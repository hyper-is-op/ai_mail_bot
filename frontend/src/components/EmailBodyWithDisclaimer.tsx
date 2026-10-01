import { useState } from 'react';
import { ChevronRight, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailBodyProps {
  content?: string | null;
  className?: string;
  customDisclaimers?: string[];
}

export function parseEmailDisclaimer(
  rawText?: string | null,
  customDisclaimers?: string[]
): { body: string; disclaimer: string | null } {
  if (!rawText) return { body: '', disclaimer: null };

  let processedText = rawText;

  // If text looks like raw HTML document, clean it into plain readable text
  if (
    processedText.includes('<!DOCTYPE') ||
    processedText.includes('<html') ||
    (processedText.includes('<head') && processedText.includes('<body')) ||
    (processedText.includes('<table') && processedText.includes('</table'))
  ) {
    try {
      const doc = new DOMParser().parseFromString(processedText, 'text/html');
      // Remove scripts, styles, metadata
      const scripts = doc.querySelectorAll('script, style, head, meta, noscript, svg');
      scripts.forEach(el => el.remove());
      processedText = doc.body.innerText || doc.body.textContent || processedText;
    } catch {
      processedText = processedText
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // 1. Check custom configured client disclaimers first
  if (customDisclaimers && customDisclaimers.length > 0) {
    let earliestMatchIdx = -1;
    for (const d of customDisclaimers) {
      if (!d || !d.trim()) continue;
      const idx = processedText.toLowerCase().indexOf(d.trim().toLowerCase());
      if (idx !== -1 && (earliestMatchIdx === -1 || idx < earliestMatchIdx)) {
        earliestMatchIdx = idx;
      }
    }
    if (earliestMatchIdx !== -1) {
      const body = processedText.slice(0, earliestMatchIdx).trim();
      const disclaimer = processedText.slice(earliestMatchIdx).trim();
      if (body) {
        return { body, disclaimer };
      }
    }
  }

  // 2. Fallback to standard built-in disclaimer regex
  const disclaimerRegex = /(?:(?:\r?\n|^)(?:--\s*\r?\n)?(?:\*?DISCLAIMER:?\*?|This email and its attachments are confidential|\*?Confidentiality Notice:?\*?|IMPORTANT NOTICE:?\s*This email|Towards Vision Technologies Limited is not liable)[\s\S]*)/i;

  const match = processedText.match(disclaimerRegex);
  if (!match || match.index === undefined) {
    return { body: processedText.trim(), disclaimer: null };
  }

  const body = processedText.slice(0, match.index).trim();
  const disclaimer = match[0].trim();

  // If the entire text was matched as a disclaimer (no main body), don't collapse everything
  if (!body && disclaimer) {
    return { body: disclaimer, disclaimer: null };
  }

  return { body, disclaimer };
}

export default function EmailBodyWithDisclaimer({ content, className, customDisclaimers }: EmailBodyProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { body, disclaimer } = parseEmailDisclaimer(content, customDisclaimers);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Main Clean Email Message Body */}
      {body && (
        <div className="whitespace-pre-wrap leading-relaxed">
          {body}
        </div>
      )}

      {/* Expandable / Collapsible Disclaimer Section */}
      {disclaimer && (
        <div className="pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200/80 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer group select-none shadow-2xs"
          >
            <ChevronRight className={cn("w-3 h-3 text-muted-foreground group-hover:text-foreground transition-transform duration-200", isExpanded && "rotate-90 text-foreground")} />
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500/80 group-hover:text-amber-500 transition-colors" />
            <span className="font-semibold text-foreground/90">Disclaimer &amp; Confidentiality Notice</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              ({isExpanded ? 'collapse' : 'expand'})
            </span>
          </button>

          {isExpanded && (
            <div className="mt-2 p-3.5 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap animate-in fade-in-50 duration-200 border-l-2 border-l-amber-500 shadow-2xs">
              {disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
