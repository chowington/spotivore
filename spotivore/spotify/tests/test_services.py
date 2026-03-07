import json
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.test import RequestFactory
from django.utils import timezone

from spotivore.spotify.services import SpotifyOAuthService
from spotivore.spotify.tests.factories import SpotifyConnectionFactory


class DummyHTTPResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


@pytest.fixture(autouse=True)
def spotify_settings(settings):
    settings.SPOTIFY_CLIENT_ID = "spotify-client-id"
    settings.SPOTIFY_CLIENT_SECRET = "spotify-client-secret"
    settings.SPOTIFY_SCOPES = ("playlist-read-private", "user-read-email")
    settings.SPOTIFY_REDIRECT_URI = ""
    settings.SPOTIFY_TOKEN_REFRESH_LEEWAY_SECONDS = 60


@pytest.mark.django_db
class TestSpotifyOAuthService:
    def test_build_redirect_uri_uses_callback_route(self):
        request = RequestFactory().get("/api/spotify/auth-url/")
        service = SpotifyOAuthService.from_settings()

        redirect_uri = service.build_redirect_uri(request)

        assert redirect_uri == "http://testserver/spotify/callback/"

    def test_ensure_valid_access_token_refreshes_expired_connection(self):
        connection = SpotifyConnectionFactory(
            expires_at=timezone.now() - timedelta(minutes=5),
            refresh_token="refresh-me",
        )
        service = SpotifyOAuthService.from_settings()

        with patch(
            "spotivore.spotify.services.urlopen",
            return_value=DummyHTTPResponse(
                {
                    "access_token": "new-access-token",
                    "token_type": "Bearer",
                    "scope": "playlist-read-private user-read-email",
                    "expires_in": 3600,
                },
            ),
        ):
            access_token = service.ensure_valid_access_token(connection)

        connection.refresh_from_db()
        assert access_token == "new-access-token"
        assert connection.access_token == "new-access-token"
        assert connection.refresh_token == "refresh-me"
        assert connection.expires_at > timezone.now()
