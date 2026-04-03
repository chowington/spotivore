from unittest.mock import MagicMock
from unittest.mock import patch

import pytest
from django.core.exceptions import ImproperlyConfigured
from rest_framework.test import APIRequestFactory
from rest_framework.test import force_authenticate

from spotivore.music.api.views import ListeningSessionView
from spotivore.music.api.views import PlaylistViewSet
from spotivore.music.models import ListeningSession
from spotivore.music.models import Playlist
from spotivore.music.models import Track
from spotivore.music.tests.factories import ListeningSessionFactory
from spotivore.music.tests.factories import PlaylistFactory
from spotivore.music.tests.factories import TrackFactory
from spotivore.music.tests.factories import TrackInPlaylistFactory
from spotivore.spotify.services import SpotifyAPIError
from spotivore.spotify.tests.factories import SpotifyConnectionFactory
from spotivore.users.models import User
from spotivore.users.tests.factories import UserFactory


class TestPlaylistViewSet:
    @pytest.fixture
    def api_rf(self) -> APIRequestFactory:
        return APIRequestFactory()

    def test_get_queryset_is_scoped_to_user(
        self, user: User, api_rf: APIRequestFactory
    ):
        owned = PlaylistFactory(owner=user)
        PlaylistFactory()

        view = PlaylistViewSet()
        request = api_rf.get("/api/playlists/")
        request.user = user
        view.request = request

        assert list(view.get_queryset()) == [owned]

    @pytest.mark.skip(reason="sync action not yet implemented")
    @pytest.mark.django_db
    def test_sync_creates_playlist_and_entries(
        self, user: User, api_rf: APIRequestFactory
    ):
        view = PlaylistViewSet.as_view({"post": "sync"})
        request = api_rf.post(
            "/api/playlists/sync/",
            {
                "spotify_id": "1234567890123456789012",
                "name": "Road Trip",
                "tracks": [
                    {"spotify_id": "abcdefghijklmnopqrstuv", "name": "First"},
                    {"spotify_id": "bcdefghijklmnopqrstuvw", "name": "Second"},
                ],
            },
            format="json",
        )
        force_authenticate(request, user=user)

        response = view(request)

        playlist = Playlist.objects.get(owner=user, spotify_id="1234567890123456789012")
        assert response.status_code == 200
        assert playlist.name == "Road Trip"
        assert list(playlist.entries.values_list("position", flat=True)) == [0, 1]
        assert Track.objects.filter(
            spotify_id="abcdefghijklmnopqrstuv", name="First"
        ).exists()

    @pytest.mark.skip(reason="sync action not yet implemented")
    @pytest.mark.django_db
    def test_sync_replaces_changed_track_and_clears_sublist(
        self,
        user: User,
        api_rf: APIRequestFactory,
    ):
        playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
        sublist = PlaylistFactory(owner=user, spotify_id="zyxwvutsrqponmlkjihgfe")
        entry = TrackInPlaylistFactory(
            playlist=playlist,
            position=0,
            sublist=sublist,
        )

        view = PlaylistViewSet.as_view({"post": "sync"})
        request = api_rf.post(
            "/api/playlists/sync/",
            {
                "spotify_id": playlist.spotify_id,
                "tracks": [
                    {"spotify_id": "abcdefghijklmnopqrstuv", "name": "Replacement"}
                ],
            },
            format="json",
        )
        force_authenticate(request, user=user)

        response = view(request)
        entry.refresh_from_db()

        assert response.status_code == 200
        assert entry.track.spotify_id == "abcdefghijklmnopqrstuv"
        assert entry.sublist is None

    @pytest.mark.django_db
    def test_assign_sublists_to_playlist_entry(
        self, user: User, api_rf: APIRequestFactory
    ):
        playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
        TrackInPlaylistFactory(playlist=playlist, position=0)

        view = PlaylistViewSet.as_view({"post": "sublists"})
        request = api_rf.post(
            f"/api/playlists/{playlist.spotify_id}/sublists/",
            {
                "position": 0,
                "sublist_spotify_id": "abcdefghijklmnopqrstuv",
                "sublist_name": "Warmup",
            },
            format="json",
        )
        force_authenticate(request, user=user)

        response = view(request, spotify_id=playlist.spotify_id)

        playlist.refresh_from_db()
        entry = playlist.entries.get(position=0)
        assert response.status_code == 200
        assert entry.sublist is not None
        assert entry.sublist.spotify_id == "abcdefghijklmnopqrstuv"
        assert entry.sublist.name == "Warmup"

    @pytest.mark.django_db
    def test_list_sublists_returns_only_embedded_entries(
        self, user: User, api_rf: APIRequestFactory
    ):
        playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
        sublist = PlaylistFactory(owner=user, spotify_id="abcdefghijklmnopqrstuv")
        TrackInPlaylistFactory(playlist=playlist, position=0, sublist=sublist)
        TrackInPlaylistFactory(playlist=playlist, position=1, sublist=None)

        view = PlaylistViewSet.as_view({"get": "sublists"})
        request = api_rf.get(f"/api/playlists/{playlist.spotify_id}/sublists/")
        force_authenticate(request, user=user)

        response = view(request, spotify_id=playlist.spotify_id)

        embedded_entry = playlist.entries.get(position=0)
        assert response.status_code == 200
        assert len(response.data) == 1
        entry_data = response.data[0]
        assert entry_data["position"] == 0
        assert entry_data["track"]["spotify_id"] == embedded_entry.track.spotify_id
        assert entry_data["sublist_spotify_id"] == sublist.spotify_id
        assert entry_data["sublist_name"] == sublist.name

    @pytest.mark.django_db
    def test_list_requires_authentication(self, api_rf: APIRequestFactory):
        view = PlaylistViewSet.as_view({"get": "list"})
        request = api_rf.get("/api/playlists/")
        response = view(request)
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_create_assigns_owner_to_authenticated_user(
        self, user: User, api_rf: APIRequestFactory
    ):
        view = PlaylistViewSet.as_view({"post": "create"})
        request = api_rf.post(
            "/api/playlists/",
            {"spotify_id": "abcdefghijklmnopqrstuv", "name": "My Playlist"},
            format="json",
        )
        force_authenticate(request, user=user)
        view(request)
        assert Playlist.objects.filter(owner=user, spotify_id="abcdefghijklmnopqrstuv").exists()

    @pytest.mark.django_db
    def test_retrieve_includes_entries(self, user: User, api_rf: APIRequestFactory):
        playlist = PlaylistFactory(owner=user, spotify_id="abcdefghijklmnopqrstuv")
        TrackInPlaylistFactory(playlist=playlist, position=0)

        view = PlaylistViewSet.as_view({"get": "retrieve"})
        request = api_rf.get(f"/api/playlists/{playlist.spotify_id}/")
        force_authenticate(request, user=user)

        response = view(request, spotify_id=playlist.spotify_id)

        assert response.status_code == 200
        assert "entries" in response.data

    @pytest.mark.django_db
    def test_sublists_post_returns_400_for_nonexistent_position(
        self, user: User, api_rf: APIRequestFactory
    ):
        playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")

        view = PlaylistViewSet.as_view({"post": "sublists"})
        request = api_rf.post(
            f"/api/playlists/{playlist.spotify_id}/sublists/",
            {"position": 0, "sublist_spotify_id": "abcdefghijklmnopqrstuv"},
            format="json",
        )
        force_authenticate(request, user=user)

        response = view(request, spotify_id=playlist.spotify_id)

        assert response.status_code == 400
        assert "position" in response.data

    @pytest.mark.django_db
    def test_sublists_post_returns_400_for_self_reference(
        self, user: User, api_rf: APIRequestFactory
    ):
        playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
        TrackInPlaylistFactory(playlist=playlist, position=0)

        view = PlaylistViewSet.as_view({"post": "sublists"})
        request = api_rf.post(
            f"/api/playlists/{playlist.spotify_id}/sublists/",
            {"position": 0, "sublist_spotify_id": playlist.spotify_id},
            format="json",
        )
        force_authenticate(request, user=user)

        response = view(request, spotify_id=playlist.spotify_id)

        assert response.status_code == 400
        assert "sublist_spotify_id" in response.data

    @pytest.mark.django_db
    def test_sublists_post_updates_existing_sublist_name(
        self, user: User, api_rf: APIRequestFactory
    ):
        playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
        sublist = PlaylistFactory(
            owner=user, spotify_id="abcdefghijklmnopqrstuv", name="Old Name"
        )
        TrackInPlaylistFactory(playlist=playlist, position=0)

        view = PlaylistViewSet.as_view({"post": "sublists"})
        request = api_rf.post(
            f"/api/playlists/{playlist.spotify_id}/sublists/",
            {
                "position": 0,
                "sublist_spotify_id": sublist.spotify_id,
                "sublist_name": "New Name",
            },
            format="json",
        )
        force_authenticate(request, user=user)

        response = view(request, spotify_id=playlist.spotify_id)

        sublist.refresh_from_db()
        assert response.status_code == 200
        assert sublist.name == "New Name"

    @pytest.mark.django_db
    def test_tracks_returns_404_when_no_spotify_connection(
        self, user: User, api_rf: APIRequestFactory
    ):
        playlist = PlaylistFactory(owner=user, spotify_id="abcdefghijklmnopqrstuv")

        view = PlaylistViewSet.as_view({"get": "tracks"})
        request = api_rf.get(f"/api/playlists/{playlist.spotify_id}/tracks/")
        force_authenticate(request, user=user)

        response = view(request, spotify_id=playlist.spotify_id)

        assert response.status_code == 404

    @pytest.mark.django_db
    def test_tracks_returns_503_on_improperly_configured(
        self, user: User, api_rf: APIRequestFactory
    ):
        SpotifyConnectionFactory(user=user)

        view = PlaylistViewSet.as_view({"get": "tracks"})
        request = api_rf.get("/api/playlists/abcdefghijklmnopqrstuv/tracks/")
        force_authenticate(request, user=user)

        with patch("spotivore.music.api.views.SpotifyOAuthService.from_settings") as mock_from:
            mock_service = MagicMock()
            mock_from.return_value = mock_service
            mock_service.get_playlist_tracks.side_effect = ImproperlyConfigured("misconfigured")

            response = view(request, spotify_id="abcdefghijklmnopqrstuv")

        assert response.status_code == 503

    @pytest.mark.django_db
    def test_tracks_returns_502_on_spotify_api_error(
        self, user: User, api_rf: APIRequestFactory
    ):
        SpotifyConnectionFactory(user=user)

        view = PlaylistViewSet.as_view({"get": "tracks"})
        request = api_rf.get("/api/playlists/abcdefghijklmnopqrstuv/tracks/")
        force_authenticate(request, user=user)

        with patch("spotivore.music.api.views.SpotifyOAuthService.from_settings") as mock_from:
            mock_service = MagicMock()
            mock_from.return_value = mock_service
            mock_service.get_playlist_tracks.side_effect = SpotifyAPIError("api error")

            response = view(request, spotify_id="abcdefghijklmnopqrstuv")

        assert response.status_code == 502

    @pytest.mark.django_db
    def test_tracks_calls_sync_when_playlist_exists_locally(
        self, user: User, api_rf: APIRequestFactory
    ):
        SpotifyConnectionFactory(user=user)
        playlist = PlaylistFactory(owner=user, spotify_id="abcdefghijklmnopqrstuv")
        fake_tracks = [
            {
                "position": 0,
                "spotify_id": "zzzzzzzzzzzzzzzzzzzzzz",
                "name": "T",
                "artists": [],
                "album": "",
                "uri": "",
            }
        ]

        view = PlaylistViewSet.as_view({"get": "tracks"})
        request = api_rf.get(f"/api/playlists/{playlist.spotify_id}/tracks/")
        force_authenticate(request, user=user)

        with patch("spotivore.music.api.views.SpotifyOAuthService.from_settings") as mock_from, \
             patch("spotivore.music.api.views.sync_playlist") as mock_sync:
            mock_service = MagicMock()
            mock_from.return_value = mock_service
            mock_service.get_playlist_tracks.return_value = fake_tracks

            response = view(request, spotify_id=playlist.spotify_id)

        assert response.status_code == 200
        mock_sync.assert_called_once()

    @pytest.mark.django_db
    def test_tracks_does_not_sync_when_playlist_not_local(
        self, user: User, api_rf: APIRequestFactory
    ):
        SpotifyConnectionFactory(user=user)
        fake_tracks = [
            {
                "position": 0,
                "spotify_id": "zzzzzzzzzzzzzzzzzzzzzz",
                "name": "T",
                "artists": [],
                "album": "",
                "uri": "",
            }
        ]

        view = PlaylistViewSet.as_view({"get": "tracks"})
        request = api_rf.get("/api/playlists/abcdefghijklmnopqrstuv/tracks/")
        force_authenticate(request, user=user)

        with patch("spotivore.music.api.views.SpotifyOAuthService.from_settings") as mock_from, \
             patch("spotivore.music.api.views.sync_playlist") as mock_sync:
            mock_service = MagicMock()
            mock_from.return_value = mock_service
            mock_service.get_playlist_tracks.return_value = fake_tracks

            response = view(request, spotify_id="abcdefghijklmnopqrstuv")

        assert response.status_code == 200
        mock_sync.assert_not_called()


@pytest.mark.django_db
class TestListeningSessionView:
    @pytest.fixture
    def api_rf(self) -> APIRequestFactory:
        return APIRequestFactory()

    def test_get_returns_session_data(self, user: User, api_rf: APIRequestFactory):
        session = ListeningSessionFactory(
            owner=user,
            playlist_spotify_id="abcdefghijklmnopqrstuv",
            current_track_uri="spotify:track:xyz",
            position_ms=3000,
            track_uris=["spotify:track:xyz"],
        )

        view = ListeningSessionView.as_view()
        request = api_rf.get(f"/api/sessions/{session.playlist_spotify_id}/")
        force_authenticate(request, user=user)

        response = view(request, playlist_spotify_id=session.playlist_spotify_id)

        assert response.status_code == 200
        assert response.data["current_track_uri"] == "spotify:track:xyz"
        assert response.data["position_ms"] == 3000

    def test_get_returns_404_when_no_session(self, user: User, api_rf: APIRequestFactory):
        view = ListeningSessionView.as_view()
        request = api_rf.get("/api/sessions/abcdefghijklmnopqrstuv/")
        force_authenticate(request, user=user)

        response = view(request, playlist_spotify_id="abcdefghijklmnopqrstuv")

        assert response.status_code == 404

    def test_get_returns_403_when_unauthenticated(self, api_rf: APIRequestFactory):
        view = ListeningSessionView.as_view()
        request = api_rf.get("/api/sessions/abcdefghijklmnopqrstuv/")

        response = view(request, playlist_spotify_id="abcdefghijklmnopqrstuv")

        assert response.status_code == 403

    def test_put_creates_new_session(self, user: User, api_rf: APIRequestFactory):
        view = ListeningSessionView.as_view()
        request = api_rf.put(
            "/api/sessions/abcdefghijklmnopqrstuv/",
            {
                "current_track_uri": "spotify:track:abc",
                "position_ms": 500,
                "track_uris": ["spotify:track:abc"],
            },
            format="json",
        )
        force_authenticate(request, user=user)

        response = view(request, playlist_spotify_id="abcdefghijklmnopqrstuv")

        assert response.status_code == 200
        assert ListeningSession.objects.filter(
            owner=user, playlist_spotify_id="abcdefghijklmnopqrstuv"
        ).exists()

    def test_put_updates_existing_session(self, user: User, api_rf: APIRequestFactory):
        session = ListeningSessionFactory(
            owner=user,
            playlist_spotify_id="abcdefghijklmnopqrstuv",
            current_track_uri="spotify:track:old",
            position_ms=0,
        )

        view = ListeningSessionView.as_view()
        request = api_rf.put(
            f"/api/sessions/{session.playlist_spotify_id}/",
            {
                "current_track_uri": "spotify:track:new",
                "position_ms": 9000,
                "track_uris": [],
            },
            format="json",
        )
        force_authenticate(request, user=user)

        response = view(request, playlist_spotify_id=session.playlist_spotify_id)

        session.refresh_from_db()
        assert response.status_code == 200
        assert session.current_track_uri == "spotify:track:new"
        assert session.position_ms == 9000
        assert (
            ListeningSession.objects.filter(
                owner=user, playlist_spotify_id=session.playlist_spotify_id
            ).count()
            == 1
        )

    def test_put_uses_playlist_spotify_id_from_url(
        self, user: User, api_rf: APIRequestFactory
    ):
        view = ListeningSessionView.as_view()
        request = api_rf.put(
            "/api/sessions/abcdefghijklmnopqrstuv/",
            {
                "playlist_spotify_id": "zzzzzzzzzzzzzzzzzzzzzz",  # should be overridden by URL
                "current_track_uri": "spotify:track:abc",
                "position_ms": 0,
                "track_uris": [],
            },
            format="json",
        )
        force_authenticate(request, user=user)

        response = view(request, playlist_spotify_id="abcdefghijklmnopqrstuv")

        assert response.status_code == 200
        assert ListeningSession.objects.filter(
            owner=user, playlist_spotify_id="abcdefghijklmnopqrstuv"
        ).exists()

    def test_put_returns_403_when_unauthenticated(self, api_rf: APIRequestFactory):
        view = ListeningSessionView.as_view()
        request = api_rf.put(
            "/api/sessions/abcdefghijklmnopqrstuv/",
            {
                "current_track_uri": "spotify:track:abc",
                "position_ms": 0,
                "track_uris": [],
            },
            format="json",
        )

        response = view(request, playlist_spotify_id="abcdefghijklmnopqrstuv")

        assert response.status_code == 403

    def test_get_is_scoped_to_user(self, api_rf: APIRequestFactory):
        other_user = UserFactory()
        session = ListeningSessionFactory(
            owner=other_user,
            playlist_spotify_id="abcdefghijklmnopqrstuv",
        )
        requesting_user = UserFactory()

        view = ListeningSessionView.as_view()
        request = api_rf.get(f"/api/sessions/{session.playlist_spotify_id}/")
        force_authenticate(request, user=requesting_user)

        response = view(request, playlist_spotify_id=session.playlist_spotify_id)

        assert response.status_code == 404
