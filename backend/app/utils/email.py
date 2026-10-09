import smtplib
from email.message import EmailMessage
from app.config import settings

def send_otp_email(to_email: str, otp: str):
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        print(f"Mock Email: To: {to_email}, OTP: {otp} (Configure SMTP to send real emails)")
        return

    msg = EmailMessage()
    msg['Subject'] = 'Your Login OTP for HK DigiVerse HRMS'
    msg['From'] = settings.SENDER_EMAIL or settings.SMTP_USER
    msg['To'] = to_email

    plain_content = f"""Hello,

Your One-Time Password (OTP) for login is: {otp}

This OTP is valid for 5 minutes. Do not share it with anyone.

Regards,
HK DigiVerse HRMS Team
"""
    msg.set_content(plain_content)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login OTP for HK DigiVerse HRMS</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 12px 30px rgba(5, 150, 105, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          
          <!-- Top HRMS Emerald Gradient Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 50%, #0d9488 100%); padding: 34px 30px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.22); border-radius: 9999px; padding: 6px 18px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.3);">
                <span style="color: #ffffff; font-size: 13px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">HK DigiVerse HRMS</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Login Verification Code</h1>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #0f172a;">
                Hello,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #475569;">
                We received a sign-in request for your <strong>HK DigiVerse HRMS</strong> account. Please use the 6-digit verification code below to login:
              </p>

              <!-- OTP Display Box in HRMS Emerald Theme -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 20px 0;">
                <tr>
                  <td align="center" style="background: linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px dashed #059669; border-radius: 18px; padding: 24px 16px;">
                    <span style="display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #059669; margin-bottom: 8px;">
                      Your One-Time Password
                    </span>
                    <div style="font-family: 'Consolas', 'Courier New', Courier, monospace; font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #064e3b; padding-left: 12px; margin: 4px 0; user-select: all; -webkit-user-select: all; -moz-user-select: all;">
                      {otp}
                    </div>

                    <!-- Copy Button in Email -->
                    <div style="margin-top: 14px;">
                      <button 
                        type="button"
                        onclick="navigator.clipboard.writeText('{otp}');"
                        style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; padding: 9px 22px; border-radius: 9999px; border: none; cursor: pointer; text-decoration: none; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.28); user-select: all; -webkit-user-select: all;"
                      >
                        📋 Copy OTP ({otp})
                      </button>
                    </div>

                    <span style="display: block; font-size: 11px; color: #64748b; margin-top: 10px; font-weight: 500;">
                      (Click button or double-tap code to copy)
                    </span>
                  </td>
                </tr>
              </table>

              <!-- 5 Min Expiry Alert -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 14px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #854d0e;">
                      ⏱️ <strong>Valid for 5 minutes:</strong> This code will expire shortly. For security, never share this OTP with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #64748b;">
                If you did not request this OTP, please ignore this email or contact your HR administrator immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #334155;">
                HK DigiVerse HRMS Security
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                This is an automated system message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    msg.add_alternative(html_content, subtype='html')

    try:
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
