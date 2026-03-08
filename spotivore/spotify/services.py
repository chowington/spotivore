import json
from base64 import b64encode
from dataclasses import dataclass
from datetime import timedelta
from urllib.error import HTTPError
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request
from urllib.request import urlopen

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.urls import reverse
from django.utils import timezone

from spotivore.spotify.models import SpotifyConnection

SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1"


class SpotifyAPIError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


@dataclass(slots=True)
class SpotifyOAuthService:
    client_id: str
    client_secret: str
    scopes: tuple[str, ...]
    refresh_leeway_seconds: int = 60

    @classmethod
    def from_settings(cls) -> "SpotifyOAuthService":
        return cls(
            client_id=settings.SPOTIFY_CLIENT_ID,
            client_secret=settings.SPOTIFY_CLIENT_SECRET,
            scopes=tuple(settings.SPOTIFY_SCOPES),
            refresh_leeway_seconds=settings.SPOTIFY_TOKEN_REFRESH_LEEWAY_SECONDS,
        )

    def ensure_configured(self) -> None:
        if not self.client_id or not self.client_secret:
            raise ImproperlyConfigured(
                "Spotify OAuth is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
            )

    def build_redirect_uri(self, request) -> str:
        configured_redirect_uri = settings.SPOTIFY_REDIRECT_URI
        if configured_redirect_uri:
            return configured_redirect_uri
        return request.build_absolute_uri(reverse("spotify:callback"))

    def build_authorize_url(self, *, state: str, redirect_uri: str) -> str:
        self.ensure_configured()
        payload = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": " ".join(self.scopes),
            "state": state,
        }
        return f"{SPOTIFY_AUTHORIZE_URL}?{urlencode(payload)}"

    def exchange_code_for_tokens(self, *, code: str, redirect_uri: str) -> dict:
        self.ensure_configured()
        return self._post_form(
            SPOTIFY_TOKEN_URL,
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )

    def refresh_access_token(self, *, refresh_token: str) -> dict:
        self.ensure_configured()
        return self._post_form(
            SPOTIFY_TOKEN_URL,
            {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )

    def build_connection_defaults(
        self, token_payload: dict, profile_payload: dict
    ) -> dict:
        return {
            "spotify_user_id": profile_payload["id"],
            "display_name": profile_payload.get("display_name", "") or "",
            "email": profile_payload.get("email", "") or "",
            "access_token": token_payload["access_token"],
            "refresh_token": token_payload.get("refresh_token", ""),
            "token_type": token_payload.get("token_type", "Bearer"),
            "scope": token_payload.get("scope", " ".join(self.scopes)),
            "expires_at": timezone.now()
            + timedelta(seconds=int(token_payload.get("expires_in", 3600))),
        }

    def ensure_valid_access_token(self, connection: SpotifyConnection) -> str:
        if not connection.is_expired(self.refresh_leeway_seconds):
            return connection.access_token

        token_payload = self.refresh_access_token(
            refresh_token=connection.refresh_token
        )
        connection.access_token = token_payload["access_token"]
        connection.token_type = token_payload.get("token_type", connection.token_type)
        connection.scope = token_payload.get("scope", connection.scope)
        connection.expires_at = timezone.now() + timedelta(
            seconds=int(token_payload.get("expires_in", 3600)),
        )
        if token_payload.get("refresh_token"):
            connection.refresh_token = token_payload["refresh_token"]

        connection.save(
            update_fields=[
                "access_token",
                "refresh_token",
                "token_type",
                "scope",
                "expires_at",
                "modified",
            ],
        )
        return connection.access_token

    def fetch_current_user_profile(self, access_token: str) -> dict:
        return self._get_json(f"{SPOTIFY_API_BASE_URL}/me", access_token)

    def get_current_user_playlists(self, connection: SpotifyConnection) -> list[dict]:
        access_token = self.ensure_valid_access_token(connection)
        items = self._paginate(
            f"{SPOTIFY_API_BASE_URL}/me/playlists?limit=50",
            access_token,
        )
        return [
            {
                "spotify_id": item["id"],
                "name": item.get("name", ""),
                "description": item.get("description", "") or "",
                "owner_name": item.get("owner", {}).get("display_name", "") or "",
                "is_public": item.get("public"),
                "track_count": item.get("items", {}).get("total", 0),
            }
            for item in items
            if item.get("id")
        ]

    def get_playlist_tracks(
        self, connection: SpotifyConnection, spotify_id: str
    ) -> list[dict]:
        access_token = self.ensure_valid_access_token(connection)
        items = self._paginate(
            f"{SPOTIFY_API_BASE_URL}/playlists/{spotify_id}/items?limit=100",
            access_token,
        )
        tracks: list[dict] = []
        for position, item in enumerate(items):
            track = item.get("track") or {}
            if not track.get("id"):
                continue
            tracks.append(
                {
                    "position": position,
                    "spotify_id": track["id"],
                    "name": track.get("name", "") or "",
                    "artists": [
                        artist.get("name", "") or ""
                        for artist in track.get("artists", [])
                        if artist.get("name")
                    ],
                    "album": track.get("album", {}).get("name", "") or "",
                    "uri": track.get("uri", "") or "",
                },
            )
        return tracks

    def _paginate(self, url: str, access_token: str) -> list[dict]:
        items: list[dict] = []
        next_url = url
        while next_url:
            payload = self._get_json(next_url, access_token)
            items.extend(payload.get("items", []))
            next_url = payload.get("next")
        return items

    def _post_form(self, url: str, payload: dict[str, str]) -> dict:
        encoded_payload = urlencode(payload).encode("utf-8")
        auth_token = b64encode(
            f"{self.client_id}:{self.client_secret}".encode("utf-8")
        ).decode("ascii")
        request = Request(
            url,
            data=encoded_payload,
            headers={
                "Authorization": f"Basic {auth_token}",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            method="POST",
        )
        return self._send_json(request)

    def _get_json(self, url: str, access_token: str) -> dict:
        request = Request(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            method="GET",
        )
        return self._send_json(request)

    def _send_json(self, request: Request) -> dict:
        try:
            with urlopen(request) as response:
                body = response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8")
            raise SpotifyAPIError(detail or str(exc), status_code=exc.code) from exc
        except URLError as exc:
            raise SpotifyAPIError(str(exc.reason)) from exc

        if not body:
            return {}
        return json.loads(body)
