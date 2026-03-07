from django.urls import resolve
from django.urls import reverse


def test_playlist_list():
    assert reverse("api:playlist-list") == "/api/playlists/"
    assert resolve("/api/playlists/").view_name == "api:playlist-list"


def test_playlist_detail():
    url = reverse(
        "api:playlist-detail", kwargs={"spotify_id": "1234567890123456789012"}
    )
    assert url == "/api/playlists/1234567890123456789012/"
    assert resolve(url).view_name == "api:playlist-detail"


def test_playlist_sync():
    assert reverse("api:playlist-sync") == "/api/playlists/sync/"
    assert resolve("/api/playlists/sync/").view_name == "api:playlist-sync"


def test_playlist_sublists():
    url = reverse(
        "api:playlist-sublists", kwargs={"spotify_id": "1234567890123456789012"}
    )
    assert url == "/api/playlists/1234567890123456789012/sublists/"
    assert resolve(url).view_name == "api:playlist-sublists"
