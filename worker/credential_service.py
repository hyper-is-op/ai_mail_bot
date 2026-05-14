import requests
import time
import logging
from threading import Lock

ACCOUNT_API = "http://172.16.3.215:8024/email-account/4"

logger = logging.getLogger(__name__)


class EmailCredentialService:
    def __init__(self, api_url, cache_ttl=300, max_retries=3, timeout=10):
        self.api_url = api_url
        self.cache_ttl = cache_ttl
        self.max_retries = max_retries
        self.timeout = timeout

        self._cache = None
        self._last_fetched = 0
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

    def _fetch_from_api(self):
        """Fetch credentials from API with retry logic"""

        for attempt in range(1, self.max_retries + 1):
            try:
                start_time = time.time()

                self._log(
                    "info",
                    "Fetching credentials from API",
                    attempt=attempt
                )

                response = requests.get(self.api_url, timeout=self.timeout)
                response.raise_for_status()

                latency = round(time.time() - start_time, 3)

                data = response.json()

                email_user = data.get("email")
                email_pass = data.get("password")

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

                return email_user, email_pass

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
        return None, None

    def get_credentials(self, force_refresh=False):
        """
        Get credentials with caching
        """
        with self._lock:
            current_time = time.time()

            # Cache hit
            if (
                not force_refresh
                and self._cache
                and (current_time - self._last_fetched < self.cache_ttl)
            ):
                self._log(
                    "info",
                    "Returning cached credentials",
                    cache_age=round(current_time - self._last_fetched, 2)
                )
                return self._cache

            self._log(
                "info",
                "Cache miss or force refresh triggered",
                force_refresh=force_refresh
            )

            creds = self._fetch_from_api()

            if creds != (None, None):
                self._cache = creds
                self._last_fetched = current_time

                self._log(
                    "info",
                    "Cache updated successfully"
                )
            else:
                self._log(
                    "error",
                    "Credentials fetch failed, cache not updated"
                )

            return creds


# Singleton instance
credential_service = EmailCredentialService(ACCOUNT_API)


def get_email_credentials():
    return credential_service.get_credentials()