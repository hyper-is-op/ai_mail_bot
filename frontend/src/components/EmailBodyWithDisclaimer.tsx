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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/30 transition-colors cursor-pointer group select-none"
          >
            <ChevronRight className={cn("w-3 h-3 text-zinc-400 transition-transform duration-200", isExpanded && "rotate-90 text-zinc-200")} />
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 transition-colors" />
            <span>Disclaimer & Confidentiality Notice</span>
            <span className="text-[10px] text-zinc-500 font-mono">
              ({isExpanded ? 'collapse' : 'expand'})
            </span>
          </button>

          {isExpanded && (
            <div className="mt-2 p-3 rounded-xl bg-black/40 border border-white/10 text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap animate-in fade-in-50 duration-200 border-l-2 border-l-amber-500/40">
              {disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
