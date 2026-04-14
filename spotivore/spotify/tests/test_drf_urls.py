from django.urls import resolve
from django.urls import reverse


def test_spotify_auth_url():
    assert reverse("spotify_api:auth-url") == "/api/spotify/auth-url/"
    assert resolve("/api/spotify/auth-url/").view_name == "spotify_api:auth-url"


def test_spotify_connection_url():
    assert reverse("spotify_api:connection") == "/api/spotify/connection/"
    assert resolve("/api/spotify/connection/").view_name == "spotify_api:connection"


def test_spotify_playlist_urls():
    assert reverse("spotify_api:playlist-list") == "/api/spotify/playlists/"
    assert resolve("/api/spotify/playlists/").view_name == "spotify_api:playlist-list"

    spotify_id = "1234567890123456789012"
    assert (
        reverse("spotify_api:playlist-tracks", kwargs={"spotify_id": spotify_id})
        == f"/api/spotify/playlists/{spotify_id}/tracks/"
    )
    assert (
        resolve(f"/api/spotify/playlists/{spotify_id}/tracks/").view_name
        == "spotify_api:playlist-tracks"
    )
