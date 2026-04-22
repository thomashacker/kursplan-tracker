"""
Email service using SMTP (works with any provider — KAS, Gmail, etc.).
Uses Python standard library only, no extra dependencies.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


def send_invitation_email(
    to_email: str,
    club_name: str,
    invited_by_name: str,
    role: str,
    accept_url: str,
) -> None:
    role_labels = {"admin": "Administrator", "trainer": "Trainer", "member": "Mitglied"}
    role_label = role_labels.get(role, role)

    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Einladung zu {club_name}</h2>
      <p>{invited_by_name} hat dich als <strong>{role_label}</strong> zu
         <strong>{club_name}</strong> eingeladen.</p>
      <p>
        <a href="{accept_url}"
           style="background:#2563eb;color:#fff;padding:12px 24px;
                  border-radius:6px;text-decoration:none;display:inline-block;">
          Einladung annehmen
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px;">
        Dieser Link ist 7 Tage gültig. Falls du diese Einladung nicht erwartet hast,
        kannst du sie ignorieren.
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Einladung zu {club_name}"
    msg["From"] = settings.email_from
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.email_from, to_email, msg.as_string())
