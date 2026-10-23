# Social Automation Module Documentation
**New-HRMS Native Social Automation Suite**

---

## 1. Overview & Architecture

The **Social Automation Module** consolidates four previously disparate n8n workflows into a single, high-performance, native New-HRMS module:
1. **Instagram Comment-to-DM with Follow-Gate**
2. **Instagram Keyword Form & Precedence Matcher** (with Live Simulator & CSV Import)
3. **AI Viral Reel Scriptwriter** (Hooks, Scene Breakdown, CTAs & Revisions)
4. **AI Caption & SEO Studio** (Angle A/B/D, 3-tier Hashtags & Vision)

All operations run natively within FastAPI, MongoDB, and React with zero external webhook dependencies or n8n instances.

---

## 2. Meta Webhook & App Setup

### 2.1 Meta for Developers Configuration
1. Navigate to [developers.facebook.com](https://developers.facebook.com) &gt; **My Apps** &gt; Select or create a **Business** App.
2. Under **Products**, add **Instagram Graph API** and **Webhooks**.
3. In **Webhooks &gt; Instagram**:
   - **Callback URL**: `https://<your-domain>/webhooks/meta/instagram`
   - **Verify Token**: Configured in `.env` as `META_VERIFY_TOKEN` (default: `hrms_instagram_secret_token_2026`).
   - Click **Verify and Save**.
4. In Webhook subscriptions, subscribe to:
   - `comments`
   - `messaging_postbacks`
5. Copy your **App Secret** from App Settings &gt; Basic into `.env` as `META_APP_SECRET`.

### 2.2 Security & Webhook Handling
- **Instant 200 HTTP Response**: When Meta dispatches an event, the webhook validates HMAC-SHA256 signature and returns `{"status": "received"}` within ~10ms, processing the payload asynchronously via `BackgroundTasks`.
- **HMAC-SHA256 Signature**: Handled in `social_webhook.py` using `X-Hub-Signature-256`. Malformed or forged requests are rejected with 403 Forbidden.
- **Atomic Deduplication**: Every incoming comment ID is recorded in the `social_dedupe` collection with a unique `_id`. Duplicate webhook deliveries from Meta are discarded automatically.

---

## 3. Account Management & Token Security

### 3.1 Fernet Encryption at Rest
- All Instagram long-lived access tokens are encrypted using 256-bit AES Fernet before storage in the `social_ig_accounts` collection.
- Key resolution:
  1. `SOCIAL_ENC_KEY` from `.env`
  2. Falls back securely to a SHA-256 base64 derivation of `SECRET_KEY`.
- Raw tokens are **never** logged or returned to the client frontend. The UI only displays the last 4 characters (`token_last4: "****3a9f"`).

### 3.2 Automated Token Refresh Scheduler
- Instagram long-lived user tokens expire in 60 days.
- `SocialScheduler` executes every day at **04:00 IST** (using distributed MongoDB lock `social_locks`).
- Accounts with tokens older than 45 days are refreshed via Meta Graph API:
  `GET /oauth/access_token?grant_type=ig_refresh_token&access_token={token}`
- Token health status is displayed with visual badges:
  - 🟢 **Healthy**: &lt; 50 days old
  - 🟡 **Expiring Soon**: 50–59 days old
  - 🔴 **Expired / Action Required**: &ge; 60 days old

---

## 4. Keyword Form & Rule Matcher

### 4.1 Normalization & Exact Match Rule
To prevent false-positive trigger loops, comments and rules are normalized via:
1. Unicode NFKC normalization
2. Removal of zero-width spaces (`\u200B` to `\u200D`, `\uFEFF`)
3. Collapsing multiple spaces into single spaces
4. Trimming and uppercase conversion

A match triggers if and only if:
$$\text{norm}(\text{comment}) == \text{norm}(\text{rule.keyword})$$

### 4.2 Scope Precedence
- **Post-Specific Rules** (`scope: SPECIFIC_POSTS` with `media_id`): Evaluated first.
- **Global Rules** (`scope: ALL_POSTS`): Evaluated only if no specific rule matches the post.

### 4.3 Anti-Spam Rotating Public Replies
- Each keyword rule supports up to 3 public reply variations (e.g. *"Check your DM 📩"*, *"Just sent it over! 📩"*, *"Sent! Have a look at your inbox 📩"*).
- The engine rotates randomly through configured variants to protect business accounts from Instagram automated spam penalties.

---

## 5. Follow-Gate Engine

1. When a user comments an active keyword, the engine checks whether they already follow the business account via Graph API:
   `GET /{igsid}?fields=is_user_follow_business`
2. **If following**: Sends the requested DM message immediately.
3. **If not following**:
   - Stores the pending request in `social_pending_dms` with a configurable TTL (default 10 minutes).
   - Sends a Generic Button Template to the user's DM:
     - Text: *"Thanks for your interest! Please follow @{username} and tap below to unlock your link 👇"*
     - Postback Button: Payload `IM_FOLLOWING`.
4. When the user taps the button or types a confirmation phrase (*"done"*, *"following"*, *"followed"*), the engine verifies their follow state, dispatches the held DM, and deletes the pending record.

---

## 6. AI Viral Reel Scriptwriter & SEO Studio

### 6.1 Multi-Provider Fallback Chain
- **Primary**: Google Gemini 2.5 Flash
- **Fallback 1**: Groq Primary Key (`llama-3.3-70b-versatile`)
- **Fallback 2**: Groq Secondary Key (if configured)
- All requests are executed directly via async `httpx` with timeout defense.

### 6.2 Prompt Injection Defense
User topics and custom notes are strictly isolated within XML delimiter tags:
```
<untrusted_topic>
{user_input}
</untrusted_topic>
```
System instructions enforce that content within untrusted tags is parsed purely as subject matter, preventing prompt override attacks.

### 6.3 Script Structure & Features
- **3–5 Viral Hook Angles**: Visual action, spoken words, text overlay.
- **Scene Breakdown**: Chronological table with camera angle, narration, on-screen text, timing.
- **Call-to-Action Options**: Multiple high-converting options.
- **Script Revisions**: Seamless revision engine (`/social/scripts/{id}/revise`).
- **Brand Integration**: Injects target brand voice, tone, forbidden words, and signature CTA.

---

## 7. Frontend User Interface (`/social`)

The UI is built with TailwindCSS and Lucide icons, accessible at `/social` with sub-tabs:
- **Dashboard** (`/social/dashboard`): Real-time metrics, KPI cards, and live event stream.
- **Accounts** (`/social/accounts`): Connect Instagram accounts, test tokens, monitor expiry.
- **Keywords** (`/social/keywords`): Create/edit rules, live test simulator, bulk CSV import.
- **Activity** (`/social/activity`): Event logs with JSON payload inspector, pending follow-gate requests with countdown timers.
- **Reel Scripts** (`/social/scripts`): AI script generation, hook comparison, scene table, script library.
- **Captions & SEO** (`/social/captions`): 3-angle captions (A/B/D), 3-tier hashtags (1M+, 100k+, niche), SEO keywords.
- **Brand Profiles** (`/social/brands`): Brand guidelines, tone of voice, forbidden words.
- **Settings** (`/social/settings`): Webhook guide, live provider latency tester, log retention slider (1–30 days).

---

## 8. Verification & Test Commands

### Backend Tests
```bash
cd backend
.\venv\Scripts\python.exe -m unittest discover -s tests -p "test_social_*.py"
```

### Frontend Typecheck
```bash
cd Frontend
npx tsc --noEmit
```

### Frontend Build
```bash
cd Frontend
npm run build
```
