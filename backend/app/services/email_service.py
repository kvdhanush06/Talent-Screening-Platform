"""Email Service - Interview invitations and notifications via Gmail SMTP."""

import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via Gmail SMTP."""

    def __init__(self):
        self.host = settings.EMAIL_HOST
        self.port = settings.EMAIL_PORT
        self.user = settings.EMAIL_USER
        self.password = settings.EMAIL_PASSWORD
        self.from_email = settings.FROM_EMAIL
        self._available = bool(self.user and self.password)

    async def send_interview_invitation(
        self,
        to_email: str,
        candidate_name: str,
        job_title: str,
        company_name: str,
        interview_link: str,
    ) -> bool:
        """Send an interview invitation email to a candidate."""
        subject = f"Interview Invitation: {job_title} at {company_name}"
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563EB, #1D4ED8); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">Interview Invitation</h1>
            </div>
            <div style="background: #FFFFFF; padding: 30px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="color: #1E293B; font-size: 16px;">Dear <strong>{candidate_name}</strong>,</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                    Congratulations! You have been shortlisted for the position of
                    <strong>{job_title}</strong> at <strong>{company_name}</strong>.
                </p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                    We would like to invite you to complete an asynchronous video interview.
                    The interview consists of a few questions, and you will have time to prepare
                    your answers before recording.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{interview_link}"
                       style="background: #2563EB; color: #FFFFFF; padding: 14px 32px; border-radius: 8px;
                              text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block;">
                        Start Your Interview
                    </a>
                </div>
                <div style="background: #F8FAFC; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <p style="color: #64748B; font-size: 13px; margin: 0;">
                        <strong>Tips:</strong><br>
                        • Find a quiet, well-lit space<br>
                        • Use a stable internet connection<br>
                        • You'll have 30 seconds to prepare per question<br>
                        • Recording time is 3 minutes per answer<br>
                        • You cannot re-record once submitted
                    </p>
                </div>
                <p style="color: #64748B; font-size: 14px;">
                    If the button above doesn't work, copy this link into your browser:<br>
                    <span style="color: #2563EB; word-break: break-all;">{interview_link}</span>
                </p>
                <p style="color: #64748B; font-size: 14px; margin-top: 20px;">
                    Best regards,<br>
                    <strong>{company_name} Hiring Team</strong>
                </p>
            </div>
        </body>
        </html>
        """
        return self._send_email(to_email, subject, html_body)

    async def send_notification(
        self,
        to_email: str,
        subject: str,
        message: str,
    ) -> bool:
        """Send a plain notification email."""
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px;">
            <div style="background: #2563EB; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="color: white; margin: 0;">Talent Screening Platform</h2>
            </div>
            <div style="padding: 24px; border: 1px solid #E2E8F0;">
                <p style="color: #475569; line-height: 1.6;">{message}</p>
            </div>
        </body>
        </html>
        """
        return self._send_email(to_email, subject, html_body)

    def _send_email(self, to_email: str, subject: str, html_body: str) -> bool:
        """Send an email synchronously."""
        if not self._available:
            logger.warning(f"Email not configured. Would send to {to_email}: {subject}")
            return False

        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = self.from_email
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(html_body, "html"))

            context = ssl.create_default_context()
            with smtplib.SMTP(self.host, self.port) as server:
                server.starttls(context=context)
                server.login(self.user, self.password)
                server.sendmail(self.from_email, to_email, msg.as_string())

            logger.info(f"Email sent to {to_email}: {subject}")
            return True
        except smtplib.SMTPAuthenticationError:
            logger.error("SMTP authentication failed. Check EMAIL_USER and EMAIL_PASSWORD.")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error sending to {to_email}: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False


# Singleton instance
email_service = EmailService()
