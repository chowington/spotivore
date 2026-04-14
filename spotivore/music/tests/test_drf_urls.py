import pytest
from django.urls import resolve
from django.urls import reverse

from spotivore.music.api.views import ListeningSessionView


def test_playlist_list():
    assert reverse("api:playlist-list") == "/api/playlists/"
    assert resolve("/api/playlists/").view_name == "api:playlist-list"


def test_playlist_detail():
    url = reverse(
        "api:playlist-detail",
        kwargs={"spotify_id": "1234567890123456789012"},
    )
    assert url == "/api/playlists/1234567890123456789012/"
    assert resolve(url).view_name == "api:playlist-detail"


@pytest.mark.skip(reason="sync action not yet implemented")
def test_playlist_sync():
    assert reverse("api:playlist-sync") == "/api/playlists/sync/"
    assert resolve("/api/playlists/sync/").view_name == "api:playlist-sync"


def test_playlist_sublists():
    url = reverse(
        "api:playlist-sublists",
        kwargs={"spotify_id": "1234567890123456789012"},
    )
    assert url == "/api/playlists/1234567890123456789012/sublists/"
    assert resolve(url).view_name == "api:playlist-sublists"


def test_playlist_tracks():
    url = reverse(
        "api:playlist-tracks",
        kwargs={"spotify_id": "1234567890123456789012"},
    )
    assert url == "/api/playlists/1234567890123456789012/tracks/"
    assert resolve(url).view_name == "api:playlist-tracks"


def test_listening_session_url():
    url = reverse(
        "api:listening-session",
        kwargs={"playlist_spotify_id": "1234567890123456789012"},
    )
    assert url == "/api/sessions/1234567890123456789012/"
    assert resolve(url).view_name == "api:listening-session"


def test_listening_session_resolves_to_correct_view():
    resolved = resolve("/api/sessions/1234567890123456789012/")
    assert resolved.func.view_class is ListeningSessionView
