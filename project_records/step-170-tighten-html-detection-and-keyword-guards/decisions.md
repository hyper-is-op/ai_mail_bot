# Decisions - Step 170: Tighten HTML Detection and Keyword Guards

- **Strict HTML Tag Boundary Check**:
  - *Context*: `bodyText.includes('<p')` matched plain text math/variable expressions like `x < p` or `<phone>`, causing the "Original HTML" toggle button to show on plain text emails.
  - *Choice*: Use `/<p[\s>]/i.test(bodyText) || /<\/p>/i.test(bodyText)` to match genuine HTML paragraph tags.

- **Non-Empty Allowed Keyword Phrase Validation**:
  - *Context*: In `app/keyword_filter.py`, `any(phrase in text_lower for phrase in allowed_phrases)` would match any email unconditionally if an empty string `""` existed in the database table.
  - *Choice*: Enforce `bool(phrase and phrase.strip())` both when loading from DB and when evaluating phrases in `is_blocked()`.
