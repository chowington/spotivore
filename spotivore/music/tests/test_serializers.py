import pytest
from rest_framework.test import APIRequestFactory

from spotivore.music.api.serializers import ListeningSessionSerializer
from spotivore.music.api.serializers import PlaylistDetailSerializer
from spotivore.music.api.serializers import PlaylistSerializer
from spotivore.music.api.serializers import PlaylistSublistSerializer
from spotivore.music.api.serializers import TrackSerializer
from spotivore.music.tests.factories import PlaylistFactory
from spotivore.music.tests.factories import TrackFactory
from spotivore.music.tests.factories import TrackInPlaylistFactory


def _get_request():
    return APIRequestFactory().get("/")


# ---------------------------------------------------------------------------
# TrackSerializer
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_track_serializer_includes_all_fields():
    track = TrackFactory(
        spotify_id="abcdefghijklmnopqrstuv",
        name="Song A",
        album="Album 1",
        uri="spotify:track:abcdefghijklmnopqrstuv",
        artists=["Artist 1"],
    )
    data = TrackSerializer(track).data
    assert data["spotify_id"] == "abcdefghijklmnopqrstuv"
    assert data["name"] == "Song A"
    assert data["album"] == "Album 1"
    assert data["uri"] == "spotify:track:abcdefghijklmnopqrstuv"
    assert data["artists"] == ["Artist 1"]


# ---------------------------------------------------------------------------
# PlaylistSerializer
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_playlist_serializer_track_count_equals_entry_count():
    playlist = PlaylistFactory()
    TrackInPlaylistFactory(playlist=playlist, position=0)
    TrackInPlaylistFactory(playlist=playlist, position=1)
    data = PlaylistSerializer(playlist, context={"request": _get_request()}).data
    assert data["track_count"] == 2


@pytest.mark.django_db
def test_playlist_serializer_url_contains_spotify_id():
    playlist = PlaylistFactory(spotify_id="abcdefghijklmnopqrstuv")
    data = PlaylistSerializer(playlist, context={"request": _get_request()}).data
    assert "abcdefghijklmnopqrstuv" in data["url"]


# ---------------------------------------------------------------------------
# PlaylistDetailSerializer
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_playlist_detail_serializer_includes_entries():
    playlist = PlaylistFactory()
    TrackInPlaylistFactory(playlist=playlist, position=0)
    data = PlaylistDetailSerializer(playlist, context={"request": _get_request()}).data
    assert "entries" in data
    assert len(data["entries"]) == 1
    assert "track" in data["entries"][0]
    assert "position" in data["entries"][0]


# ---------------------------------------------------------------------------
# ListeningSessionSerializer
# ---------------------------------------------------------------------------


def test_listening_session_serializer_valid_data():
    data = {
        "playlist_spotify_id": "abcdefghijklmnopqrstuv",
        "current_track_uri": "spotify:track:abc",
        "position_ms": 1000,
        "track_uris": ["spotify:track:abc"],
    }
    serializer = ListeningSessionSerializer(data=data)
    assert serializer.is_valid(), serializer.errors


def test_listening_session_serializer_current_track_uri_required():
    data = {
        "playlist_spotify_id": "abcdefghijklmnopqrstuv",
        "position_ms": 0,
        "track_uris": [],
    }
    serializer = ListeningSessionSerializer(data=data)
    assert not serializer.is_valid()
    assert "current_track_uri" in serializer.errors


def test_listening_session_serializer_track_uris_is_optional():
    # track_uris is required=False; omitting it is valid
    data = {
        "playlist_spotify_id": "abcdefghijklmnopqrstuv",
        "current_track_uri": "spotify:track:abc",
        "position_ms": 0,
    }
    serializer = ListeningSessionSerializer(data=data)
    assert serializer.is_valid(), serializer.errors


# ---------------------------------------------------------------------------
# PlaylistSublistSerializer
# ---------------------------------------------------------------------------


def test_playlist_sublist_serializer_valid_data():
    data = {
        "position": 0,
        "sublist_spotify_id": "abcdefghijklmnopqrstuv",
        "sublist_name": "Warmup",
    }
    serializer = PlaylistSublistSerializer(data=data)
    assert serializer.is_valid(), serializer.errors


def test_playlist_sublist_serializer_position_rejects_negative():
    data = {
        "position": -1,
        "sublist_spotify_id": "abcdefghijklmnopqrstuv",
    }
    serializer = PlaylistSublistSerializer(data=data)
    assert not serializer.is_valid()
    assert "position" in serializer.errors


def test_playlist_sublist_serializer_rejects_invalid_spotify_id_format():
    data = {
        "position": 0,
        "sublist_spotify_id": "too-short!",
    }
    serializer = PlaylistSublistSerializer(data=data)
    assert not serializer.is_valid()
    assert "sublist_spotify_id" in serializer.errors


def test_playlist_sublist_serializer_sublist_name_is_optional():
    data = {
        "position": 0,
        "sublist_spotify_id": "abcdefghijklmnopqrstuv",
    }
    serializer = PlaylistSublistSerializer(data=data)
    assert serializer.is_valid(), serializer.errors
