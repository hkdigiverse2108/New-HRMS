from typing import List, Dict, Any, Tuple, Optional
from app.services.social.utils import norm, clean_id

def match_keyword_rules(
    comment_text: str,
    comment_media_id: Optional[str],
    rules: List[Dict[str, Any]]
) -> Tuple[Optional[Dict[str, Any]], str]:
    """Matches incoming comment against account rules.
    - Post-specific rules (media_id != '') take precedence over global rules (media_id == '').
    - Match requires exact match on normalized text: norm(comment) == rule.keyword_norm.
    - Punctuation, extra words, emoji outside the keyword will NOT match (exact match rule).
    """
    if not comment_text or not isinstance(comment_text, str):
        return None, "Empty comment text"

    norm_comment = norm(comment_text)
    if not norm_comment:
        return None, "Empty comment after normalisation"

    cleaned_media_id = clean_id(comment_media_id or "")

    # Sort so post-specific rules come before global rules (scope precedence)
    sorted_rules = sorted(
        rules,
        key=lambda r: 0 if clean_id(r.get("media_id") or "") else 1
    )

    for rule in sorted_rules:
        if not rule.get("is_active", True):
            continue

        rule_keyword_norm = norm(rule.get("keyword_norm") or rule.get("keyword", ""))
        if not rule_keyword_norm:
            continue

        # 1. Exact text match
        if norm_comment != rule_keyword_norm:
            continue

        # 2. Scope check: post-specific or all-posts
        rule_media_id = clean_id(rule.get("media_id") or "")
        if rule_media_id and cleaned_media_id and rule_media_id != cleaned_media_id:
            continue
        if rule_media_id and not cleaned_media_id:
            continue

        # 3. Message check
        msg = (rule.get("message") or rule.get("reply_text") or "").strip()
        if not msg:
            return None, f"Matched keyword '{rule.get('keyword')}' but rule message is empty"

        return rule, f"Matched rule '{rule.get('keyword')}'"

    return None, f"No matching active keyword for normalized text '{norm_comment}'"

def test_match_rules(
    comment_text: str,
    comment_media_id: Optional[str],
    rules: List[Dict[str, Any]]
) -> Dict[str, Any]:
    norm_comment = norm(comment_text or "")
    matched_rule, reason = match_keyword_rules(comment_text, comment_media_id, rules)
    return {
        "input_comment": comment_text,
        "normalized_comment": norm_comment,
        "matched": matched_rule is not None,
        "reason": reason,
        "matched_rule": matched_rule
    }
