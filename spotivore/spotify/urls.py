from django.urls import path

from spotivore.spotify.views import SpotifyCallbackView

app_name = "spotify"

urlpatterns = [
    path("callback/", SpotifyCallbackView.as_view(), name="callback"),
]

