import pytest
from rest_framework.test import APIRequestFactory
from rest_framework.test import force_authenticate

from spotivore.music.api.views import PlaylistViewSet
from spotivore.music.models import Playlist
from spotivore.music.models import Track
from spotivore.music.tests.factories import PlaylistFactory
from spotivore.music.tests.factories import TrackInPlaylistFactory
from spotivore.users.models import User


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
        assert response.data == [
            {
                "position": 0,
                "track": {
                    "spotify_id": embedded_entry.track.spotify_id,
                    "name": embedded_entry.track.name,
                },
                "sublist_spotify_id": sublist.spotify_id,
                "sublist_name": sublist.name,
            },
        ]
