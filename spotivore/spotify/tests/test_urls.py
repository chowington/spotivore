from django.urls import resolve
from django.urls import reverse


def test_spotify_callback_url():
    assert reverse("spotify:callback") == "/spotify/callback/"
    assert resolve("/spotify/callback/").view_name == "spotify:callback"

