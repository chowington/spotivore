from unittest.mock import patch

import pytest
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from spotivore.spotify.models import SpotifyConnection
from spotivore.users.models import User


class CallbackSpotifyServiceStub:
    def build_redirect_uri(self, request) -> str:
        return "http://testserver/spotify/callback/"

    def exchange_code_for_tokens(self, *, code: str, redirect_uri: str) -> dict:
        assert code == "spotify-code"
        assert redirect_uri == "http://testserver/spotify/callback/"
        return {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "token_type": "Bearer",
            "scope": "playlist-read-private user-read-email",
            "expires_in": 3600,
        }

    def fetch_current_user_profile(self, access_token: str) -> dict:
        assert access_token == "access-token"
        return {
            "id": "spotify-user-123",
            "display_name": "Spotify Person",
            "email": "spotify@example.com",
        }

    def build_connection_defaults(
        self, token_payload: dict, profile_payload: dict
    ) -> dict:
        return {
            "spotify_user_id": profile_payload["id"],
            "display_name": profile_payload["display_name"],
            "email": profile_payload["email"],
            "access_token": token_payload["access_token"],
            "refresh_token": token_payload["refresh_token"],
            "token_type": token_payload["token_type"],
            "scope": token_payload["scope"],
            "expires_at": timezone.now(),
        }


@pytest.mark.django_db
class TestSpotifyCallbackView:
    @pytest.fixture
    def client(self) -> Client:
        return Client()

    def test_callback_saves_connection_and_redirects(self, user: User, client: Client):
        client.force_login(user)
        session = client.session
        session["spotify_oauth_state"] = "expected-state"
        session["spotify_oauth_next"] = "/client/spotify"
        session.save()

        service = CallbackSpotifyServiceStub()
        with patch(
            "spotivore.spotify.views.get_spotify_oauth_service", return_value=service
        ):
            response = client.get(
                reverse("spotify:callback"),
                {"state": "expected-state", "code": "spotify-code"},
            )

        connection = SpotifyConnection.objects.get(user=user)
        assert response.status_code == 302
        assert response["Location"] == "/client/spotify?spotify=connected"
        assert connection.spotify_user_id == "spotify-user-123"
        assert connection.display_name == "Spotify Person"
        assert connection.email == "spotify@example.com"
        assert connection.access_token == "access-token"
        assert connection.refresh_token == "refresh-token"
