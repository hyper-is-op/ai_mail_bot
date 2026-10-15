# Decisions: Standardize Typography and Font Tokens

## Decision 1: Native System Font Stacks over Heavy Web-Font Downloads
- **Context:** The Google Fonts import attempted to fetch `Segoe UI`, which is not hosted on Google Fonts.
- **Choice:** Clean up the `@import` to load only valid fonts (`Inter:wght@300;400;500;600;700`) and establish a zero-network-cost native system font stack: `Segoe UI` for Windows, `-apple-system` for Apple, and `Inter` for Linux/fallback.
- **Reasoning:** Zero FCP penalty, zero layout shifts (FOUT), and native visual clarity across client operating systems.

## Decision 2: Formalize Font Tokens in Tailwind
- **Context:** `tailwind.config.js` lacked `fontFamily` definitions, meaning `font-sans` reverted to Tailwind defaults.
- **Choice:** Explicitly declare `fontFamily.sans` and `fontFamily.mono` in `tailwind.config.js`.

## Decision 3: Enforce Tabular Digits on Tables & Metric Panels
- **Context:** Numeric columns in tables suffered from vertical digit misalignment due to proportional fonts.
- **Choice:** Apply `font-variant-numeric: tabular-nums` to `td, th, .tabular-nums` in `index.css`.

## Decision 4: Normalize Heading Hierarchy
- **Context:** `AiProcessing.tsx` and `Tickets.tsx` used `font-black` (900 weight), whereas `Dashboard.tsx` and `Reports.tsx` used `font-bold` (700 weight).
- **Choice:** Standardize page titles and KPI metrics to `font-bold` across all views.
