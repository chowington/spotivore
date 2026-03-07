from django.urls import path

from spotivore.spotify.api.views import SpotifyAuthURLView
from spotivore.spotify.api.views import SpotifyConnectionView
from spotivore.spotify.api.views import SpotifyPlaylistListView
from spotivore.spotify.api.views import SpotifyPlaylistTracksView

app_name = "spotify_api"

urlpatterns = [
    path("auth-url/", SpotifyAuthURLView.as_view(), name="auth-url"),
    path("connection/", SpotifyConnectionView.as_view(), name="connection"),
    path("playlists/", SpotifyPlaylistListView.as_view(), name="playlist-list"),
    path(
        "playlists/<str:spotify_id>/tracks/",
        SpotifyPlaylistTracksView.as_view(),
        name="playlist-tracks",
    ),
]
