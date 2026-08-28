"""
app/text_cleaning.py

Strips quoted/forwarded reply-chain content from email bodies before they
are used as LLM or RAG input.
"""

import re
import logging

logger = logging.getLogger(__name__)

_ON_DATE_WROTE_RE = re.compile(
    r"\bOn\s+.{0,60}?\d{1,2}(:\d{2})?\s*(AM|PM|am|pm)?\s*.{0,80}?wrote:\s*$",
    re.MULTILINE,
)

_ORIGINAL_MESSAGE_RE = re.compile(
    r"^-{2,}\s*Original Message\s*-{2,}\s*$",
    re.MULTILINE | re.IGNORECASE,
)

_FWD_HEADER_BLOCK_RE = re.compile(
    r"^From:\s.*\n(Sent|Date):\s.*\n(To:\s.*\n)?(Cc:\s.*\n)?Subject:\s.*$",
    re.MULTILINE | re.IGNORECASE,
)

_QUOTE_BLOCK_START_RE = re.compile(r"^\s*>.*$", re.MULTILINE)


def strip_quoted_reply(body: str) -> str:
    if not body:
        return body

    cut_index = len(body)
    matched_pattern = None

    for pattern, name in (
        (_ON_DATE_WROTE_RE, "on_date_wrote"),
        (_ORIGINAL_MESSAGE_RE, "original_message"),
        (_FWD_HEADER_BLOCK_RE, "fwd_header_block"),
    ):
        m = pattern.search(body)
        if m and m.start() < cut_index:
            cut_index = m.start()
            matched_pattern = name

    if matched_pattern is None:
        qm = _QUOTE_BLOCK_START_RE.search(body)
        if qm and qm.start() < cut_index:
            cut_index = qm.start()
            matched_pattern = "quote_block"

    cleaned = body[:cut_index].strip()

    if matched_pattern:
        logger.info(
            f"✂️ Stripped quoted reply chain (matched={matched_pattern}), "
            f"{len(body)} -> {len(cleaned)} chars"
        )
    else:
        logger.debug("✂️ No quote marker found — body unchanged")

    if not cleaned:
        logger.warning(
            "⚠️ Quote-stripping would have emptied the body — "
            "falling back to original unstripped text"
        )
        return body.strip()

    return cleaned


def is_html_content(text: str) -> bool:
    """Check if a string looks like raw HTML content."""
    if not text or not isinstance(text, str):
        return False
    lower = text.strip().lower()
    return (
        lower.startswith("<!doctype html")
        or lower.startswith("<html")
        or ("<head" in lower and "<body" in lower)
        or ("<table" in lower and "</table" in lower)
        or (lower.count("<p") + lower.count("<div") + lower.count("<br") >= 3)
    )


def extract_clean_text_from_html(html_content: str) -> str:
    """
    Converts raw HTML into clean, human-readable plain text.
    Strips scripts, styles, metadata, and comments, preserving line breaks.
    """
    if not html_content or not isinstance(html_content, str):
        return ""

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, "html.parser")

        # Strip scripts, styles, head, meta
        for element in soup(["script", "style", "head", "meta", "noscript", "svg"]):
            element.decompose()

        # Add newlines around block tags
        for tag in soup.find_all(["p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr"]):
            tag.insert_before("\n")

        text = soup.get_text()
    except Exception:
        # Fallback to regex-based HTML cleaning
        import html
        text = re.sub(r"<(script|style|head|meta)[^>]*>.*?</\1>", "", html_content, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
        text = re.sub(r"<(?:br|p|div|tr|li|h[1-6])[^>]*>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = html.unescape(text)

    # Normalize whitespace and multiple consecutive blank lines
    lines = [line.strip() for line in text.splitlines()]
    non_empty_lines = []
    prev_blank = False
    for line in lines:
        if line:
            non_empty_lines.append(line)
            prev_blank = False
        elif not prev_blank:
            non_empty_lines.append("")
            prev_blank = True

    cleaned_text = "\n".join(non_empty_lines).strip()
    return cleaned_text