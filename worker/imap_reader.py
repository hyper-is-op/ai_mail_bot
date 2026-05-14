import imaplib
import email
import os
import re
import time
import logging
import sys

# Ensure /app is on sys.path when running the script directly
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from worker.credential_service import get_email_credentials
from worker.tasks import process_email_task

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def listen_email():
    logger.info("🚀 Starting Email Listener Service...")

    while True:
        try:
            # ---- GET CREDS FROM API ----
            email_user, email_pass = get_email_credentials()

            if not email_user:
                logger.info("Retrying credential fetch in 30 seconds...")
                time.sleep(30)
                continue

            logger.info("📡 Connecting to Gmail IMAP...")
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(email_user, email_pass)
            mail.select("inbox")

            logger.info(f"✅ Connected to Gmail IMAP ({email_user})")

            while True:
                try:
                    mail.noop()

                    status, messages = mail.search(None, 'UNSEEN')
                    logger.debug(f"Checking mail status={status}")

                    if messages[0]:
                        unseen_count = len(messages[0].split())
                        logger.info(f"📬 Found {unseen_count} unseen email(s)")

                        for num in messages[0].split():
                            try:
                                status, data = mail.fetch(num, "(RFC822)")

                                if status != "OK" or not data:
                                    logger.warning(
                                        f"Skipping mail {num}, fetch failed"
                                    )
                                    continue

                                raw_email = next(
                                    (
                                        item[1]
                                        for item in data
                                        if isinstance(item, tuple)
                                    ),
                                    None
                                )

                                if raw_email is None:
                                    logger.warning(
                                        f"No valid mail body for {num}"
                                    )
                                    continue

                                # Mark seen before queueing
                                mail.store(num, '+FLAGS', '\\Seen')

                                msg = email.message_from_bytes(raw_email)

                                subject = msg.get("subject", "")
                                from_email = msg.get("from", "")

                                # extract actual email
                                match = re.search(
                                    r'<([^>]+)>',
                                    from_email
                                )
                                if match:
                                    from_email = match.group(1)
                                else:
                                    match = re.search(
                                        r'[\w\.-]+@[\w\.-]+\.\w+',
                                        from_email
                                    )
                                    if match:
                                        from_email = match.group(0)

                                body = ""

                                if msg.is_multipart():
                                    for part in msg.walk():
                                        if (
                                            part.get_content_type()
                                            == "text/plain"
                                        ):
                                            body = part.get_payload(
                                                decode=True
                                            ).decode(
                                                errors="ignore"
                                            )
                                            break
                                else:
                                    body = msg.get_payload(
                                        decode=True
                                    ).decode(errors="ignore")

                                logger.info(
                                    "📧 ========= NEW EMAIL ========="
                                )
                                logger.info(f"From: {from_email}")
                                logger.info(f"Subject: {subject}")
                                logger.info("📨 Sending to celery...")

                                task_result = process_email_task.delay({
                                    "from_email": from_email,
                                    "subject": subject,
                                    "body": body
                                })

                                logger.info(
                                    f"✅ Task queued: {task_result.id}"
                                )
                                logger.info(
                                    "===============================\n"
                                )

                            except Exception as e:
                                logger.error(
                                    f"Email processing error: {e}",
                                    exc_info=True
                                )

                    else:
                        logger.debug("📭 No unseen mail")

                    time.sleep(10)

                except Exception as e:
                    logger.error(
                        f"Mail polling error: {e}",
                        exc_info=True
                    )
                    break

        except Exception as e:
            logger.error(
                f"IMAP connection error: {e}",
                exc_info=True
            )

        logger.info("🔄 Reconnecting in 30 seconds...")
        time.sleep(30)


if __name__ == "__main__":
    listen_email()
