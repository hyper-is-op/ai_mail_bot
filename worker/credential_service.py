import requests
import time
import logging
from threading import Lock

import os

ACCOUNT_API_URL = os.getenv("ACCOUNT_API_URL", "http://mail_ai_api:8024/email-account/")


logger = logging.getLogger(__name__)


class EmailCredentialService:
    def __init__(self, api_url, cache_ttl=300, max_retries=3, timeout=10):
        self.api_url = api_url
        self.cache_ttl = cache_ttl
        self.max_retries = max_retries
        self.timeout = timeout

        self._cache = {}
        self._last_fetched = {}
        self._lock = Lock()

    def _log(self, level, message, **kwargs):
        """
        Standard structured logging
        """
        log_data = {
            "service": "email_credential_service",
            "api_url": self.api_url,
            "cache_enabled": True,
            **kwargs
        }

        if level == "info":
            logger.info(message, extra=log_data)
        elif level == "warning":
            logger.warning(message, extra=log_data)
        elif level == "error":
            logger.error(message, extra=log_data)

    def _fetch_from_api(self, client_id):
        """Fetch credentials from API with retry logic"""

        for attempt in range(1, self.max_retries + 1):
            try:
                start_time = time.time()

                self._log(
                    "info",
                    f"Fetching credentials from API for {client_id}",
                    attempt=attempt
                )

                url = f"{self.api_url}{client_id}"
                if not self.api_url.endswith('/'):
                    url = f"{self.api_url}/{client_id}"

                response = requests.get(url, timeout=self.timeout)
                response.raise_for_status()

                latency = round(time.time() - start_time, 3)

                data = response.json()

                email_user = data.get("email")
                email_pass = data.get("password")
                score_threshold = data.get("score_threshold", 80)

                if not email_user or not email_pass:
                    raise ValueError("email/password missing in API response")

                self._log(
                    "info",
                    "Credentials fetched successfully",
                    attempt=attempt,
                    status_code=response.status_code,
                    latency=latency,
                    email_user=email_user
                )

                return email_user, email_pass, score_threshold

            except requests.exceptions.RequestException as e:
                self._log(
                    "warning",
                    "API request failed",
                    attempt=attempt,
                    error=str(e)
                )

            except ValueError as e:
                self._log(
                    "error",
                    "Invalid API response",
                    error=str(e)
                )
                break

            except Exception as e:
                self._log(
                    "error",
                    "Unexpected error occurred",
                    attempt=attempt,
                    error=str(e)
                )

            time.sleep(2 ** attempt)

        self._log("error", "Failed to fetch credentials after retries")
        return None, None, 80

    def get_credentials(self, client_id, force_refresh=False):
        """
        Get credentials with caching
        """
        with self._lock:
            current_time = time.time()

            # Cache hit
            last_fetched = self._last_fetched.get(client_id, 0)
            if (
                not force_refresh
                and client_id in self._cache
                and (current_time - last_fetched < self.cache_ttl)
            ):
                self._log(
                    "info",
                    f"Returning cached credentials for {client_id}",
                    cache_age=round(current_time - last_fetched, 2)
                )
                return self._cache[client_id]

            self._log(
                "info",
                f"Cache miss or force refresh triggered for {client_id}",
                force_refresh=force_refresh
            )

            creds = self._fetch_from_api(client_id)

            if creds != (None, None, 80):
                self._cache[client_id] = creds
                self._last_fetched[client_id] = current_time

                self._log(
                    "info",
                    f"Cache updated successfully for {client_id}"
                )
            else:
                self._log(
                    "error",
                    "Credentials fetch failed, cache not updated"
                )

            return creds


# Singleton instance
credential_service = EmailCredentialService(ACCOUNT_API_URL)


def get_email_credentials(client_id):
    res = credential_service.get_credentials(client_id)
    return res[0], res[1]


def get_email_score_threshold(client_id):
    res = credential_service.get_credentials(client_id)
    return res[2] if len(res) > 2 else 80


def get_mailbox_oauth_token(client_id: str, provider: str, refresh_token: str, oauth_client_id: str, oauth_client_secret: str) -> str | None:
    """
    Exchanges refresh_token for a fresh OAuth 2.0 access token for Google Workspace / Microsoft 365 IMAP/SMTP XOAUTH2.
    """
    if not refresh_token or not oauth_client_id or not oauth_client_secret:
        logger.error(f"❌ Missing OAuth 2.0 refresh parameters for client {client_id}")
        return None

    prov = (provider or "google").lower()
    if "google" in prov or "gmail" in prov:
        token_url = "https://oauth2.googleapis.com/token"
    elif "microsoft" in prov or "azure" in prov or "office" in prov or "outlook" in prov:
        token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    else:
        logger.error(f"❌ Unsupported OAuth provider '{provider}' for client {client_id}")
        return None

    data = {
        "client_id": oauth_client_id,
        "client_secret": oauth_client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }

    try:
        res = requests.post(token_url, data=data, timeout=10)
        res.raise_for_status()
        token_data = res.json()
        access_token = token_data.get("access_token")
        logger.info(f"✅ Refreshed XOAUTH2 access token for {client_id} via {provider}")
        return access_token
    except Exception as e:
        logger.error(f"❌ Failed to refresh XOAUTH2 token for {client_id}: {e}")
        return None