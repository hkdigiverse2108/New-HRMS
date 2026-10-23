import hmac
import hashlib
import unittest
from app.services.social.keyword_matcher import match_keyword_rules, test_match_rules
from app.services.social.dm_engine import extract_comments_from_payload, extract_taps_from_payload
from app.controllers.social_webhook import verify_signature

class TestSocialPhase2(unittest.TestCase):
    def test_keyword_matching_exact(self):
        rules = [
            {
                "keyword": "PDF",
                "keyword_norm": "pdf",
                "media_id": None,
                "is_active": True,
                "message": "Here is the PDF!",
            },
            {
                "keyword": "PRICE",
                "keyword_norm": "price",
                "media_id": "post_123",
                "is_active": True,
                "message": "Price details sent!",
            }
        ]

        # 1. Matching global rule
        rule, reason = match_keyword_rules("  Pdf  ", None, rules)
        self.assertIsNotNone(rule)
        self.assertEqual(rule["keyword"], "PDF")

        # 2. Post-specific rule matches when post matches
        rule2, _ = match_keyword_rules("price", "post_123", rules)
        self.assertIsNotNone(rule2)
        self.assertEqual(rule2["keyword"], "PRICE")

        # 3. Post-specific rule ignored when media_id differs
        rule3, _ = match_keyword_rules("price", "post_999", rules)
        self.assertIsNone(rule3)

        # 4. Inactive rule is ignored
        rules[0]["is_active"] = False
        rule4, _ = match_keyword_rules("pdf", None, rules)
        self.assertIsNone(rule4)

    def test_scope_precedence(self):
        rules = [
            {
                "keyword": "GUIDE",
                "keyword_norm": "guide",
                "media_id": None,
                "is_active": True,
                "message": "Global guide",
            },
            {
                "keyword": "GUIDE",
                "keyword_norm": "guide",
                "media_id": "reel_456",
                "is_active": True,
                "message": "Reel 456 specific guide",
            }
        ]
        # Should pick specific over global for reel_456
        rule, _ = match_keyword_rules("Guide", "reel_456", rules)
        self.assertEqual(rule["message"], "Reel 456 specific guide")

        # Should pick global for any other reel
        rule2, _ = match_keyword_rules("Guide", "other_reel", rules)
        self.assertEqual(rule2["message"], "Global guide")

    def test_extract_comments(self):
        payload = {
            "object": "instagram",
            "entry": [
                {
                    "id": "ig_acc_100",
                    "time": 1700000000,
                    "changes": [
                        {
                            "field": "comments",
                            "value": {
                                "id": "comment_999",
                                "text": "SEND PDF please!",
                                "from": {"id": "user_111", "username": "customer_jane"},
                                "media": {"id": "media_555", "media_product_type": "REELS"}
                            }
                        }
                    ]
                }
            ]
        }
        comments = extract_comments_from_payload(payload)
        self.assertEqual(len(comments), 1)
        c = comments[0]
        self.assertEqual(c["comment_id"], "comment_999")
        self.assertEqual(c["sender_id"], "user_111")
        self.assertEqual(c["sender_username"], "customer_jane")
        self.assertEqual(c["media_id"], "media_555")
        self.assertEqual(c["account_ig_id"], "ig_acc_100")

    def test_extract_taps(self):
        payload = {
            "object": "instagram",
            "entry": [
                {
                    "id": "ig_acc_100",
                    "messaging": [
                        {
                            "sender": {"id": "user_111"},
                            "recipient": {"id": "ig_acc_100"},
                            "postback": {
                                "title": "I'm following now!",
                                "payload": "IM_FOLLOWING"
                            }
                        }
                    ]
                }
            ]
        }
        taps = extract_taps_from_payload(payload)
        self.assertEqual(len(taps), 1)
        t = taps[0]
        self.assertEqual(t["sender_id"], "user_111")
        self.assertEqual(t["account_ig_id"], "ig_acc_100")
        self.assertEqual(t["payload"], "IM_FOLLOWING")

    def test_verify_signature(self):
        secret = "super_secret_key"
        body = b'{"test": "payload"}'
        sig = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

        self.assertTrue(verify_signature(body, sig, secret))
        self.assertFalse(verify_signature(body, "sha256=invalid", secret))
        self.assertFalse(verify_signature(b'altered body', sig, secret))

if __name__ == "__main__":
    unittest.main()
