import asyncio
import logging
from datetime import datetime, timedelta
from app.utils.social_crypto import encrypt_social_token

logger = logging.getLogger("hrms.social.seed")

async def seed_social_defaults(db):
    """Seed initial Social Automation data extracted from n8n workflows if collections are empty."""
    try:
        now = datetime.utcnow()

        # 1. Global Settings
        settings_col = db["social_settings"]
        existing_settings = await settings_col.find_one({"_id": "global"})
        if not existing_settings:
            await settings_col.insert_one({
                "_id": "global",
                "cooldown_seconds": 30,
                "pending_ttl_minutes": 10,
                "gemini_script_model": "gemini-3.1-flash-lite",
                "gemini_video_model": "gemini-3.5-flash-lite",
                "gemini_media_model": "gemini-3.8-flash",
                "groq_text_model": "openai/gpt-oss-120b",
                "groq_vision_model": "qwen/qwen3.8-27b",
                "allowed_telegram_chat_ids": ["8264009249", "7009284089", "841863295"],
                "follow_gate_message": "Almost there! Please follow us on Instagram to receive this exclusive resource.",
                "follow_gate_button_text": "I'm Following",
                "already_received_message": "You have already requested this resource. We've sent it to you earlier!",
                "updated_at": now
            })
            logger.info("Initialized default social_settings.")

        # 2. Brands
        brands_col = db["social_brands"]
        if await brands_col.count_documents({}) == 0:
            brands = [
                {
                    "brand_id": "aisetuerp",
                    "brand_name": "AI Setu ERP",
                    "link": "https://aisetuerp.com",
                    "ig_id": "aisetuerp",
                    "industry": "Enterprise Software & HR Tech",
                    "about": "AI-powered next-generation HRMS, CRM, and Enterprise Automation Suite built to scale businesses.",
                    "products_services": [
                        "Smart HRMS & Biometric Attendance",
                        "Automated Payroll & Compliance",
                        "AI Social Automation & Lead Engine",
                        "Enterprise CRM & Sales Pipeline"
                    ],
                    "usps": [
                        "100% Automated Payroll in 1-Click",
                        "Autonomous Social DM & Lead Capture",
                        "Enterprise-grade Security & Role Control"
                    ],
                    "target_audience": "Founders, HR Directors, Operations Managers, SMBs",
                    "audience_age": "25-50",
                    "audience_interests": ["Business Growth", "HR Automation", "AI in Business", "Productivity"],
                    "city": "Surat",
                    "state": "Gujarat",
                    "country": "India",
                    "service_area": "Global",
                    "goal": "Generate qualified B2B enterprise leads and demo bookings",
                    "tone": "Professional, authoritative, visionary yet approachable",
                    "caption_language": "English",
                    "default_cta": "Comment 'DEMO' below to get VIP access to the platform.",
                    "always_include_hashtags": ["#HRMS", "#AIBusiness", "#EnterpriseERP", "#Automation", "#BusinessGrowth"],
                    "never_use_hashtags": ["#cheapsoftware", "#freetools"],
                    "notes": "Flagship product suite. Highlight ROI and time saved.",
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now
                },
                {
                    "brand_id": "achiwoncse",
                    "brand_name": "Achiwon CSE",
                    "link": "https://achiwon.com",
                    "ig_id": "achiwoncse",
                    "industry": "EdTech & Computer Science Training",
                    "about": "Premier tech learning academy providing high-yield coding roadmaps, system design, and AI developer bootcamps.",
                    "products_services": [
                        "Full-Stack Agentic AI Bootcamp",
                        "Data Structures & System Design Masterclass",
                        "1-on-1 Career Mentorship & Placement Prep"
                    ],
                    "usps": [
                        "Hands-on production projects",
                        "Mentored by senior engineering leaders",
                        "Direct hiring partner placement pipeline"
                    ],
                    "target_audience": "Engineering students, Aspiring Developers, Tech Career Switchers",
                    "audience_age": "18-28",
                    "audience_interests": ["Coding", "Computer Science", "Web Development", "AI Engineering", "Tech Jobs"],
                    "city": "Ahmedabad",
                    "state": "Gujarat",
                    "country": "India",
                    "service_area": "India",
                    "goal": "Educate community, distribute high-value roadmaps, drive course enrollment",
                    "tone": "Energetic, practical, empowering, direct",
                    "caption_language": "English",
                    "default_cta": "Comment 'GUIDE' to get the complete 2026 Developer Roadmap PDF sent to your DM.",
                    "always_include_hashtags": ["#Coding", "#ComputerScience", "#DeveloperRoadmap", "#TechCareers", "#Achiwon"],
                    "never_use_hashtags": ["#easycode", "#quickmoney"],
                    "notes": "Focus on clarity and actionable technical advice.",
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now
                }
            ]
            await brands_col.insert_many(brands)
            logger.info("Seeded default social_brands.")

        # 3. Instagram Accounts
        accounts_col = db["social_ig_accounts"]
        if await accounts_col.count_documents({}) == 0:
            mock_token_1 = "EAAGm0PX4ZCpsBAK7ZCZB3...sample_live_token_aisetuerp"
            mock_token_2 = "EAAGm0PX4ZCpsBAK8ZCZB4...sample_live_token_achiwoncse"

            accounts = [
                {
                    "ig_account_id": "17841405829103921",
                    "username": "aisetuerp",
                    "username_lc": "aisetuerp",
                    "brand_id": "aisetuerp",
                    "access_token_enc": encrypt_social_token(mock_token_1),
                    "token_last4": "uerp",
                    "is_active": True,
                    "token_updated_at": now - timedelta(days=5),
                    "last_refresh_status": "ok",
                    "last_webhook_at": now - timedelta(minutes=12),
                    "created_at": now - timedelta(days=30),
                    "updated_at": now,
                    "created_by": "system"
                },
                {
                    "ig_account_id": "17841406938204912",
                    "username": "achiwoncse",
                    "username_lc": "achiwoncse",
                    "brand_id": "achiwoncse",
                    "access_token_enc": encrypt_social_token(mock_token_2),
                    "token_last4": "ncse",
                    "is_active": True,
                    "token_updated_at": now - timedelta(days=8),
                    "last_refresh_status": "ok",
                    "last_webhook_at": now - timedelta(minutes=24),
                    "created_at": now - timedelta(days=20),
                    "updated_at": now,
                    "created_by": "system"
                }
            ]
            await accounts_col.insert_many(accounts)
            logger.info("Seeded default social_ig_accounts.")

        # 4. Keyword Rules
        keywords_col = db["social_keywords"]
        if await keywords_col.count_documents({}) == 0:
            keywords = [
                {
                    "ig_account_id": "17841405829103921",
                    "username": "aisetuerp",
                    "keyword": "DEMO",
                    "keyword_norm": "DEMO",
                    "message": "Hey there! Thanks for your interest in AI Setu ERP. Here is your direct VIP link to explore the live interactive dashboard: https://aisetuerp.com/demo. Let us know if you'd like an onboarding call!",
                    "comment_reply1": "Sent you a DM with the demo link! Check your inbox 🚀",
                    "comment_reply2": "Check your DMs! Link sent 📩",
                    "comment_reply3": "DM sent! Hope you enjoy the demo 💼",
                    "media_id": "",
                    "post_link": "",
                    "media_source": "none",
                    "require_follow": True,
                    "desc": "Primary B2B Demo request automation rule",
                    "is_active": True,
                    "hit_count": 48,
                    "last_hit_at": now - timedelta(hours=2),
                    "created_at": now - timedelta(days=15),
                    "updated_at": now,
                    "created_by": "system"
                },
                {
                    "ig_account_id": "17841405829103921",
                    "username": "aisetuerp",
                    "keyword": "PRICE",
                    "keyword_norm": "PRICE",
                    "message": "Hi! Here is our 2026 pricing and deployment breakdown: https://aisetuerp.com/pricing. Reply here if you need a custom quote for enterprise teams!",
                    "comment_reply1": "Check your DM for the pricing breakdown! 📊",
                    "comment_reply2": "Sent the full pricing sheet to your DM! 💼",
                    "comment_reply3": "DM delivered! Let us know if you need any assistance.",
                    "media_id": "",
                    "post_link": "",
                    "media_source": "none",
                    "require_follow": True,
                    "desc": "Automated pricing sheet delivery",
                    "is_active": True,
                    "hit_count": 27,
                    "last_hit_at": now - timedelta(hours=5),
                    "created_at": now - timedelta(days=12),
                    "updated_at": now,
                    "created_by": "system"
                },
                {
                    "ig_account_id": "17841405829103921",
                    "username": "aisetuerp",
                    "keyword": "AUTOMATION",
                    "keyword_norm": "AUTOMATION",
                    "message": "Welcome! Here is our complete 2026 Social & Workflow Automation playbook: https://aisetuerp.com/playbook. See how top teams automate 90% of manual operations.",
                    "comment_reply1": "Playbook sent to your DM! ⚡",
                    "comment_reply2": "Check your inbox for the automation blueprint! 🚀",
                    "comment_reply3": "DM sent! Hope you find it valuable.",
                    "media_id": "",
                    "post_link": "",
                    "media_source": "none",
                    "require_follow": True,
                    "desc": "Workflow playbook lead magnet",
                    "is_active": True,
                    "hit_count": 35,
                    "last_hit_at": now - timedelta(hours=8),
                    "created_at": now - timedelta(days=10),
                    "updated_at": now,
                    "created_by": "system"
                },
                {
                    "ig_account_id": "17841406938204912",
                    "username": "achiwoncse",
                    "keyword": "GUIDE",
                    "keyword_norm": "GUIDE",
                    "message": "Hey! Here is your free complete 2026 Computer Science & Developer Roadmap: https://achiwon.com/guide. Everything you need from foundational coding to modern AI agents!",
                    "comment_reply1": "Check your DM for the free guide! 🚀",
                    "comment_reply2": "Sent you the roadmap in your DM! 📚",
                    "comment_reply3": "Resource guide sent to your inbox! Check DMs 💻",
                    "media_id": "",
                    "post_link": "",
                    "media_source": "none",
                    "require_follow": True,
                    "desc": "Developer roadmap lead magnet",
                    "is_active": True,
                    "hit_count": 92,
                    "last_hit_at": now - timedelta(minutes=45),
                    "created_at": now - timedelta(days=18),
                    "updated_at": now,
                    "created_by": "system"
                },
                {
                    "ig_account_id": "17841406938204912",
                    "username": "achiwoncse",
                    "keyword": "PDF",
                    "keyword_norm": "PDF",
                    "message": "Hello! We've sent the complete cheatsheet and practice notes PDF directly to you: https://achiwon.com/notes.pdf. Save it for your revision!",
                    "comment_reply1": "Sent the PDF to your DMs! 📩",
                    "comment_reply2": "Check your DM for the cheatsheet PDF! 📝",
                    "comment_reply3": "PDF sent! Check your inbox.",
                    "media_id": "",
                    "post_link": "",
                    "media_source": "none",
                    "require_follow": True,
                    "desc": "Cheatsheet and quick notes distribution",
                    "is_active": True,
                    "hit_count": 64,
                    "last_hit_at": now - timedelta(hours=3),
                    "created_at": now - timedelta(days=14),
                    "updated_at": now,
                    "created_by": "system"
                }
            ]
            await keywords_col.insert_many(keywords)
            logger.info("Seeded default social_keywords.")

        # 5. Saved Reel Scripts
        scripts_col = db["social_scripts"]
        if await scripts_col.count_documents({}) == 0:
            scripts = [
                {
                    "brand_id": "aisetuerp",
                    "brand_name": "AI Setu ERP",
                    "title": "Eliminate 90% of Payroll & HR Bottlenecks",
                    "topic": "How High-Growth Companies Eliminate 90% of Payroll & HR Bottlenecks",
                    "purpose": "Lead Generation & B2B Authority",
                    "language": "English",
                    "target_duration_sec": 60,
                    "note": "Optimized for Instagram Reels & YouTube Shorts with fast visual cuts.",
                    "ref_url": "",
                    "hooks": [
                        {
                            "hook_number": 1,
                            "visual_action": "Creator holds up phone showing messy spreadsheet, then swipes it away",
                            "spoken_words": "Stop spending 3 hours calculating payroll and attendance every single week.",
                            "on_screen_text": "STOP WASTING 3 HOURS ON PAYROLL"
                        },
                        {
                            "hook_number": 2,
                            "visual_action": "Fast-paced screen recording of automated AI Setu ERP dashboard",
                            "spoken_words": "Here is the exact AI system modern founders use to automate team management in 2026.",
                            "on_screen_text": "THE 2026 HR AUTOMATION STACK"
                        },
                        {
                            "hook_number": 3,
                            "visual_action": "Close up camera direct address with urgent expression",
                            "spoken_words": "If your HR department is still manually tracking leaves and salary sheets, you're losing thousands.",
                            "on_screen_text": "YOU ARE LOSING THOUSANDS"
                        }
                    ],
                    "scenes": [
                        {
                            "scene_number": 1,
                            "visual_action": "Camera shows founder overwhelmed with paper attendance registers",
                            "spoken_words": "Most founders think HR is just payroll and paperwork. But past 20 team members, manual tracking turns into a chaotic mess of missing punch-ins and disputes.",
                            "on_screen_text": "MANUAL HR DOES NOT SCALE",
                            "duration_sec": 12
                        },
                        {
                            "scene_number": 2,
                            "visual_action": "Cut to clean AI Setu one-click salary slip generator and WhatsApp automation",
                            "spoken_words": "Here's the fix: our unified ERP automates biometric punch-ins, geo-fenced attendance, one-click tax calculation, and instant salary slips on WhatsApp.",
                            "on_screen_text": "1-CLICK AUTOMATED PAYROLL",
                            "duration_sec": 18
                        },
                        {
                            "scene_number": 3,
                            "visual_action": "Show mobile notification ping with approved leave request in 2 seconds",
                            "spoken_words": "It frees up over 15 hours every single week so your leadership team can focus on revenue instead of paperwork.",
                            "on_screen_text": "SAVE 15+ HOURS / WEEK",
                            "duration_sec": 15
                        }
                    ],
                    "ctas": [
                        "Comment 'DEMO' below and I'll send you a private link to test drive the platform.",
                        "Save this reel and DM us 'AUTOMATION' for the enterprise onboarding guide.",
                        "Share this with your operations manager or comment 'DEMO' to see it live."
                    ],
                    "production_notes": "Use crisp studio lighting and punchy sound design on every transition.",
                    "status": "approved",
                    "revision_count": 0,
                    "is_favorited": True,
                    "script_text": "Stop spending 3 hours calculating payroll and attendance every single week.\n\nMost founders think HR is just payroll and paperwork. But the moment you scale past 20 team members, manual tracking turns into a chaotic mess of missing punch-ins, delayed approvals, and payroll disputes.\n\nHere's the fix: our unified ERP automates biometric punch-ins, smart geo-fencing, one-click tax calculation, and instant salary slips on WhatsApp.\n\nIt frees up over 15 hours every single week so your team can focus on revenue instead of paperwork.\n\nComment 'DEMO' below and I'll send you a private link to test drive the platform.",
                    "revisions": [],
                    "created_by": "system",
                    "created_at": now - timedelta(days=2),
                    "updated_at": now
                },
                {
                    "brand_id": "achiwoncse",
                    "brand_name": "Achiwon CSE",
                    "title": "3 High-Income Coding Skills for 2026",
                    "topic": "3 High-Income Coding Skills Every Engineering Student Must Learn in 2026",
                    "purpose": "Education & Career Roadmap",
                    "language": "English",
                    "target_duration_sec": 60,
                    "note": "Viral engineering roadmap reel format.",
                    "ref_url": "",
                    "hooks": [
                        {
                            "hook_number": 1,
                            "visual_action": "Creator standing in front of dual monitors showing code and AI agents",
                            "spoken_words": "Don't waste 4 years of college memorizing outdated programming syntax.",
                            "on_screen_text": "DON'T MEMORIZE SYNTAX"
                        },
                        {
                            "hook_number": 2,
                            "visual_action": "Fast text overlay showing salaries and top hiring tech stacks",
                            "spoken_words": "These 3 engineering skills will make you stand out from 99% of computer science graduates in 2026.",
                            "on_screen_text": "TOP 1% DEVELOPER BLUEPRINT"
                        },
                        {
                            "hook_number": 3,
                            "visual_action": "Close up camera address with laptop screen in background",
                            "spoken_words": "If you want a high-paying software job this year, here is your exact blueprint.",
                            "on_screen_text": "GET HIRED IN 2026"
                        }
                    ],
                    "scenes": [
                        {
                            "scene_number": 1,
                            "visual_action": "Screen recording showing AI writing basic functions",
                            "spoken_words": "The tech job market didn't disappear—it evolved. If all you know is basic syntax, AI can write that faster than you. But if you master these three things, companies will compete to hire you.",
                            "on_screen_text": "SYNTAX IS NOT ENOUGH",
                            "duration_sec": 14
                        },
                        {
                            "scene_number": 2,
                            "visual_action": "Show architecture diagram with full-stack agents, Redis queues, and Docker",
                            "spoken_words": "First: Full-stack agentic architecture. Second: High-performance caching and distributed message queues like Redis. Third: Clean system design and asynchronous microservices.",
                            "on_screen_text": "1. AGENTS  2. REDIS  3. SYSTEM DESIGN",
                            "duration_sec": 20
                        },
                        {
                            "scene_number": 3,
                            "visual_action": "Show tablet with the curated month-by-month roadmap PDF",
                            "spoken_words": "We broke down the exact month-by-month roadmap with free project repositories so you can build your dream portfolio.",
                            "on_screen_text": "FREE 2026 TECH ROADMAP",
                            "duration_sec": 12
                        }
                    ],
                    "ctas": [
                        "Comment 'GUIDE' and I'll instantly DM you the full PDF roadmap.",
                        "DM us 'PDF' to get our curated list of 2026 tech interview projects.",
                        "Save this video for your semester prep and comment 'GUIDE' for the free kit."
                    ],
                    "production_notes": "Use dark mode IDE aesthetics and tech upbeat background lo-fi music.",
                    "status": "approved",
                    "revision_count": 0,
                    "is_favorited": True,
                    "script_text": "These 3 engineering skills will make you stand out from 99% of computer science graduates in 2026.\n\nThe tech job market didn't disappear—it evolved. If all you know is basic syntax, AI can write that faster than you. But if you know these three things, companies will compete to hire you.\n\nFirst: Full-stack agentic architecture. Building applications that integrate autonomous AI models with real-world databases.\n\nSecond: High-performance caching and distributed message queues like Redis and event streams.\n\nThird: Clean system design and asynchronous microservices.\n\nWe broke down the exact month-by-month roadmap with free project repositories.\n\nComment 'GUIDE' and I'll instantly DM you the full PDF roadmap.",
                    "revisions": [],
                    "created_by": "system",
                    "created_at": now - timedelta(days=1),
                    "updated_at": now
                }
            ]
            await scripts_col.insert_many(scripts)
            logger.info("Seeded default social_scripts.")

        # 6. Sample Pending DMs
        pending_col = db["social_pending_dms"]
        if await pending_col.count_documents({}) == 0:
            pending_items = [
                {
                    "ig_account_id": "17841405829103921",
                    "igsid": "9842104928174",
                    "message": "Hey there! Thanks for your interest in AI Setu ERP. Here is your direct VIP link to explore the live interactive dashboard: https://aisetuerp.com/demo.",
                    "keyword": "DEMO",
                    "comment_id": "18029384719284751",
                    "media_id": "18049182740192841",
                    "username": "tech_lead_rahul",
                    "created_at": now - timedelta(minutes=4),
                    "ttl_minutes": 10,
                    "expire_at": now + timedelta(minutes=6)
                },
                {
                    "ig_account_id": "17841406938204912",
                    "igsid": "9842104928199",
                    "message": "Hey! Here is your free complete 2026 Computer Science & Developer Roadmap: https://achiwon.com/guide.",
                    "keyword": "GUIDE",
                    "comment_id": "18029384719289999",
                    "media_id": "18049182740195555",
                    "username": "priya_coding",
                    "created_at": now - timedelta(minutes=7),
                    "ttl_minutes": 10,
                    "expire_at": now + timedelta(minutes=3)
                }
            ]
            await pending_col.insert_many(pending_items)
            logger.info("Seeded sample social_pending_dms.")

        # 7. Sample Event Logs
        logs_col = db["social_event_logs"]
        if await logs_col.count_documents({}) == 0:
            logs = [
                {
                    "ts": now - timedelta(minutes=4),
                    "ig_account_id": "17841405829103921",
                    "username": "aisetuerp",
                    "type": "gate_sent",
                    "status": "ok",
                    "detail": {"keyword": "DEMO", "igsid": "9842104928174", "username": "tech_lead_rahul"},
                    "error_code": None,
                    "error_subcode": None,
                    "hint": "Follow-gate message and button delivered successfully",
                    "expire_at": now + timedelta(days=2)
                },
                {
                    "ts": now - timedelta(minutes=4, seconds=2),
                    "ig_account_id": "17841405829103921",
                    "username": "aisetuerp",
                    "type": "public_reply_sent",
                    "status": "ok",
                    "detail": {"comment_id": "18029384719284751", "reply": "Sent you a DM with the demo link! Check your inbox 🚀"},
                    "error_code": None,
                    "error_subcode": None,
                    "hint": "Public reply posted to Instagram comment",
                    "expire_at": now + timedelta(days=2)
                },
                {
                    "ts": now - timedelta(minutes=4, seconds=4),
                    "ig_account_id": "17841405829103921",
                    "username": "aisetuerp",
                    "type": "matched",
                    "status": "ok",
                    "detail": {"keyword": "DEMO", "comment": "DEMO", "from_user": "tech_lead_rahul"},
                    "error_code": None,
                    "error_subcode": None,
                    "hint": "Exact keyword match triggered automation",
                    "expire_at": now + timedelta(days=2)
                },
                {
                    "ts": now - timedelta(minutes=4, seconds=5),
                    "ig_account_id": "17841405829103921",
                    "username": "aisetuerp",
                    "type": "comment_received",
                    "status": "ok",
                    "detail": {"comment_id": "18029384719284751", "text": "DEMO"},
                    "error_code": None,
                    "error_subcode": None,
                    "hint": "Instagram comment received via Meta Webhook",
                    "expire_at": now + timedelta(days=2)
                },
                {
                    "ts": now - timedelta(hours=1),
                    "ig_account_id": "17841406938204912",
                    "username": "achiwoncse",
                    "type": "dm_sent",
                    "status": "ok",
                    "detail": {"keyword": "GUIDE", "username": "rohit_dev"},
                    "error_code": None,
                    "error_subcode": None,
                    "hint": "Private DM delivered to verified follower",
                    "expire_at": now + timedelta(days=2)
                },
                {
                    "ts": now - timedelta(hours=12),
                    "ig_account_id": "",
                    "username": "system",
                    "type": "webhook_verified",
                    "status": "ok",
                    "detail": {"endpoint": "/webhooks/meta/instagram", "hub_mode": "subscribe"},
                    "error_code": None,
                    "error_subcode": None,
                    "hint": "Meta webhook challenge successfully verified",
                    "expire_at": now + timedelta(days=2)
                }
            ]
            await logs_col.insert_many(logs)
            logger.info("Seeded sample social_event_logs.")

    except Exception as e:
        logger.warning(f"Notice while seeding social defaults: {e}")
