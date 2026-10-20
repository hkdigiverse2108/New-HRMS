import re
from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

router = APIRouter(prefix="/otp", tags=["OTP"])

# Email apps strip JavaScript, so the "Copy OTP" button in OTP emails links here and this page copies it
PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Copy OTP</title>
<style>
  body {{ margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc;
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; }}
  .card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 32px 28px; text-align: center;
          box-shadow: 0 12px 30px rgba(5,150,105,.08); width: min(360px, calc(100vw - 32px)); box-sizing: border-box; }}
  .code {{ font-family: Consolas, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px;
          color: #064e3b; margin: 12px 0 20px; user-select: all; -webkit-user-select: all; }}
  button {{ background: #059669; color: #fff; border: 0; border-radius: 999px; padding: 12px 28px; font-size: 15px;
           font-weight: 700; cursor: pointer; }}
  .status {{ margin-top: 14px; font-size: 13px; color: #64748b; min-height: 18px; }}
  .ok {{ color: #059669; font-weight: 700; }}
</style>
</head>
<body>
<div class="card">
  <div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#059669;text-transform:uppercase">Your OTP</div>
  <div class="code" id="code">{code}</div>
  <button id="btn" type="button">Copy OTP</button>
  <div class="status" id="status"></div>
</div>
<script>
  var code = "{code}";
  var statusEl = document.getElementById("status");
  function done() {{
    statusEl.textContent = "OTP copied. Paste it anywhere. Closing this tab...";
    statusEl.className = "status ok";
    // Tabs opened from an email can close themselves; if the browser refuses, the message below stays
    setTimeout(function () {{
      window.close();
      setTimeout(function () {{ statusEl.textContent = "OTP copied. Paste it anywhere and close this tab."; }}, 400);
    }}, 700);
  }}
  function fallback() {{
    var t = document.createElement("textarea");
    t.value = code; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    var ok = false; try {{ ok = document.execCommand("copy"); }} catch (e) {{}}
    document.body.removeChild(t);
    if (ok) done(); else statusEl.textContent = "Tap the button to copy.";
  }}
  function copy() {{
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(done, fallback);
    else fallback();
  }}
  document.getElementById("btn").addEventListener("click", copy);
  copy();
</script>
</body>
</html>"""


@router.get("/copy", response_class=HTMLResponse, include_in_schema=False)
async def copy_otp_page(code: str = Query("")):
    # Only a 6-digit code is ever put on the page
    if not re.fullmatch(r"\d{6}", code):
        return HTMLResponse("<p style='font-family:sans-serif;text-align:center;margin-top:40px'>Invalid code.</p>", status_code=400)
    return HTMLResponse(PAGE.format(code=code), headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})
