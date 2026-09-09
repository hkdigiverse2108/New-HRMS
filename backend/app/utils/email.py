import smtplib
from email.message import EmailMessage
from app.config import settings

def send_otp_email(to_email: str, otp: str):
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        print(f"Mock Email: To: {to_email}, OTP: {otp} (Configure SMTP to send real emails)")
        return

    msg = EmailMessage()
    msg['Subject'] = 'Your Login OTP for New-HRMS'
    msg['From'] = settings.SENDER_EMAIL or settings.SMTP_USER
    msg['To'] = to_email

    content = f"""
    Hello,

    Your One-Time Password (OTP) for login is: {otp}
    
    This OTP is valid for 5 minutes. Do not share it with anyone.

    Regards,
    HRMS Team
    """
    msg.set_content(content)

    try:
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
