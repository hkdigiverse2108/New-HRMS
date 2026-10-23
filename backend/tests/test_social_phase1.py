import unittest
from app.services.social.utils import norm, clean_id, to_bool, mask, mask_dict
from app.utils.social_crypto import encrypt_social_token, decrypt_social_token

class TestSocialPhase1(unittest.TestCase):
    def test_norm(self):
        self.assertEqual(norm("  hello   world  "), "HELLO WORLD")
        self.assertEqual(norm("DM\u200B"), "DM")
        self.assertEqual(norm("price \uFEFF"), "PRICE")
        self.assertEqual(norm(None), "")

    def test_clean_id(self):
        self.assertEqual(clean_id("'1234567890'"), "1234567890")
        self.assertEqual(clean_id("  987654321 \u200C "), "987654321")
        self.assertEqual(clean_id(None), "")

    def test_to_bool(self):
        self.assertTrue(to_bool(True))
        self.assertTrue(to_bool("true"))
        self.assertTrue(to_bool("YES"))
        self.assertTrue(to_bool("1"))
        self.assertFalse(to_bool("false"))
        self.assertFalse(to_bool("0"))
        self.assertFalse(to_bool("no"))
        self.assertFalse(to_bool(None))

    def test_mask(self):
        text = "Error with access_token=EAAB123456xyz and Bearer test_token_abc"
        masked = mask(text)
        self.assertNotIn("EAAB123456xyz", masked)
        self.assertNotIn("test_token_abc", masked)
        self.assertIn("access_token=***", masked)

    def test_mask_dict(self):
        data = {
            "access_token": "secret123",
            "username": "brand_acct",
            "igsid": "17841400012345678",
            "nested": {"token": "subsecret", "normal": "ok"}
        }
        m = mask_dict(data)
        self.assertEqual(m["access_token"], "***")
        self.assertEqual(m["username"], "brand_acct")
        self.assertEqual(m["igsid"], "...5678")
        self.assertEqual(m["nested"]["token"], "***")
        self.assertEqual(m["nested"]["normal"], "ok")

    def test_social_crypto(self):
        token = "EAABwz_secret_instagram_access_token_98765"
        enc = encrypt_social_token(token)
        self.assertNotEqual(enc, token)
        self.assertTrue(len(enc) > 20)
        dec = decrypt_social_token(enc)
        self.assertEqual(dec, token)

        # Empty handling
        self.assertEqual(encrypt_social_token(""), "")
        self.assertEqual(decrypt_social_token(""), "")

if __name__ == "__main__":
    unittest.main()
