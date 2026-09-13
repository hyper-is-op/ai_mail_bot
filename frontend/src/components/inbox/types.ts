export interface EmailItem {
  id: number;
  mailId?: string;
  sender: string;
  subject: string;
  body?: string;
  preview?: string;
  body_html?: string;
  reply?: string;
  status?: string;
  raw_status?: string;
  category?: string;
  sentiment?: 'Angry' | 'Happy' | 'Neutral' | string;
  priority?: 'High' | 'Critical' | 'Medium' | 'Low' | string;
  confidence?: string;
  score?: number | string;
  time?: string;
  date_str?: string;
  summary?: string;
  execution_steps?: string[];
  client_id?: string;
  [key: string]: any;
}

export interface ThreadItem {
  key: string;
  subject: string;
  sender: string;
  emails: EmailItem[];
  latest_email: EmailItem;
  id: number;
  status?: string;
  priority?: string;
  sentiment?: string;
  score?: number | string;
  time?: string;
  date_str?: string;
}

export interface PausedEmailItem {
  id: number;
  from_email: string;
  subject: string;
  body: string;
  status?: 'pending_review' | 'replied' | 'ignored' | string;
  created_at?: string;
  [key: string]: any;
}

export interface BlockedEmailItem {
  id: number;
  from_email: string;
  subject: string;
  body: string;
  matched_keyword: string;
  status?: 'pending_review' | 'replied' | 'ignored' | string;
  created_at?: string;
  [key: string]: any;
}

export type InboxTabType = 'All' | 'Marketing' | 'Replied' | 'Processing' | 'Failed' | 'Pending Review' | 'Paused' | 'Blocked';

export const getCleanSnippet = (text?: string): string => {
  if (!text) return '';
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Strips active executable scripts, objects, and event handlers,
 * and injects Content Security Policy and responsive styles to properly render HTML emails.
 */
export const sanitizeSandboxedHtml = (rawHtml?: string): string => {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  
  // 1. Strip dangerous tags
  let cleaned = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<applet\b[^>]*>/gi, '')
    .replace(/<meta\s+http-equiv=["']?refresh["']?[^>]*>/gi, '');

  // 2. Strip inline event handlers (onload, onclick, onerror, onmouseover, etc.)
  cleaned = cleaned.replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 3. Neutralize javascript: pseudo-protocol in links
  cleaned = cleaned.replace(/href\s*=\s*['"]?javascript:[^'">]*['"]?/gi, 'href="#"');

  // 4. Inject CSP that allows all styles, fonts, and images while strictly blocking scripts & forms
  const securityAndStyleInjections = `
    <meta http-equiv="Content-Security-Policy" content="default-src * data: blob: 'unsafe-inline'; script-src 'none'; object-src 'none'; form-action 'none';">
    <base target="_blank">
    <style>
      body {
        margin: 0 !important;
        padding: 16px !important;
        background-color: #ffffff !important;
        color: #1a1a1a !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.5;
        -webkit-text-size-adjust: 100%;
        box-sizing: border-box;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
      }
      table {
        max-width: 100% !important;
      }
    </style>
  `;
  
  if (/<head[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<head[^>]*>/i, `$&${securityAndStyleInjections}`);
  } else if (/<html[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<html[^>]*>/i, `$&<head>${securityAndStyleInjections}</head>`);
  }
  return `<!DOCTYPE html><html><head>${securityAndStyleInjections}</head><body>${cleaned}</body></html>`;
};

// Normalize subject to strip Re/Fwd prefixes for thread grouping
export const normalizeSubject = (subj?: string): string => {
  if (!subj) return 'No Subject';
  return subj.replace(/^(Re|RE|Fwd|FWD|fwd|re):\s*/i, '').trim();
};
