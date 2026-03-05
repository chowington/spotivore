from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from spotivore.spotify.models import SpotifyConnection
from spotivore.spotify.tests.factories import SpotifyConnectionFactory
from spotivore.users.models import User


class StubSpotifyService:
    def __init__(self):
        self.redirect_uri = "http://testserver/spotify/callback/"

    def build_redirect_uri(self, request) -> str:
        return self.redirect_uri

    def build_authorize_url(self, *, state: str, redirect_uri: str) -> str:
        return f"https://accounts.spotify.com/authorize?state={state}&redirect_uri={redirect_uri}"

    def get_current_user_playlists(self, connection: SpotifyConnection) -> list[dict]:
        return [
            {
                "spotify_id": "1234567890123456789012",
                "name": "Road Trip",
                "description": "",
                "owner_name": connection.display_name,
                "is_public": False,
                "track_count": 42,
            },
        ]

    def get_playlist_tracks(self, connection: SpotifyConnection, spotify_id: str) -> list[dict]:
        return [
            {
                "position": 0,
                "spotify_id": "abcdefghijklmnopqrstuv",
                "name": "First Song",
                "artists": ["Test Artist"],
                "album": "Test Album",
                "uri": f"spotify:track:{spotify_id}",
            },
        ]


@pytest.mark.django_db
class TestSpotifyAPIViews:
    @pytest.fixture
    def api_client(self) -> APIClient:
        return APIClient()

    def test_auth_url_sets_session_state(self, user: User, api_client: APIClient):
        api_client.force_login(user)
        service = StubSpotifyService()

        with patch("spotivore.spotify.api.views.get_spotify_oauth_service", return_value=service):
            response = api_client.get(
                reverse("spotify_api:auth-url"),
                {"next": "/client/spotify"},
            )

        assert response.status_code == 200
        assert response.json()["authorize_url"].startswith("https://accounts.spotify.com/authorize?")
        session = api_client.session
        assert session["spotify_oauth_state"]
        assert session["spotify_oauth_next"] == "/client/spotify"

    def test_connection_returns_connected_state(
        self,
        user: User,
        api_client: APIClient,
    ):
        connection = SpotifyConnectionFactory(user=user)
        api_client.force_login(user)

        response = api_client.get(reverse("spotify_api:connection"))

        assert response.status_code == 200
        assert response.json() == {
            "connected": True,
            "spotify_user_id": connection.spotify_user_id,
            "display_name": connection.display_name,
            "email": connection.email,
            "scopes": connection.scopes,
            "expires_at": connection.expires_at.isoformat().replace("+00:00", "Z"),
        }

    def test_delete_connection_disconnects_user(self, user: User, api_client: APIClient):
        SpotifyConnectionFactory(user=user)
        api_client.force_login(user)

        response = api_client.delete(reverse("spotify_api:connection"))

        assert response.status_code == 204
        assert not SpotifyConnection.objects.filter(user=user).exists()

    def test_playlist_list_returns_spotify_playlists(self, user: User, api_client: APIClient):
        connection = SpotifyConnectionFactory(user=user)
        api_client.force_login(user)
        service = StubSpotifyService()

        with patch("spotivore.spotify.api.views.get_spotify_oauth_service", return_value=service):
            response = api_client.get(reverse("spotify_api:playlist-list"))

        assert response.status_code == 200
        assert response.json() == [
            {
                "spotify_id": "1234567890123456789012",
                "name": "Road Trip",
                "description": "",
                "owner_name": connection.display_name,
                "is_public": False,
                "track_count": 42,
            },
        ]

    def test_playlist_tracks_returns_spotify_tracks(self, user: User, api_client: APIClient):
        SpotifyConnectionFactory(user=user)
        api_client.force_login(user)
        service = StubSpotifyService()
        spotify_id = "1234567890123456789012"

        with patch("spotivore.spotify.api.views.get_spotify_oauth_service", return_value=service):
            response = api_client.get(
                reverse("spotify_api:playlist-tracks", kwargs={"spotify_id": spotify_id}),
            )

        assert response.status_code == 200
        assert response.json() == [
            {
                "position": 0,
                "spotify_id": "abcdefghijklmnopqrstuv",
                "name": "First Song",
                "artists": ["Test Artist"],
                "album": "Test Album",
                "uri": f"spotify:track:{spotify_id}",
            },
        ]
