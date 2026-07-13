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