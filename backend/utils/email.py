from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from core.config import settings

logger = logging.getLogger(__name__)


def _is_email_delivery_configured() -> bool:
    return bool(settings.email_notifications_enabled and settings.smtp_host)


def send_notification_email(
    *,
    recipient_email: str,
    subject: str,
    plain_text_body: str,
) -> bool:
    """Send a plain-text notification email.

    Returns True when delivery succeeds, False otherwise. Delivery failures are
    logged and never raised to caller so in-app notifications remain reliable.
    """
    if not _is_email_delivery_configured():
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = recipient_email
    message.set_content(plain_text_body)

    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as client:
                if settings.smtp_username:
                    client.login(settings.smtp_username, settings.smtp_password)
                client.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as client:
                if settings.smtp_use_tls:
                    client.starttls()
                if settings.smtp_username:
                    client.login(settings.smtp_username, settings.smtp_password)
                client.send_message(message)
        return True
    except Exception:
        logger.exception("Failed sending notification email to %s", recipient_email)
        return False
