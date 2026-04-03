import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from spotivore.music.models import ListeningSession
from spotivore.music.models import Playlist
from spotivore.music.models import Track
from spotivore.music.models import TrackInPlaylist
from spotivore.music.tests.factories import ListeningSessionFactory
from spotivore.music.tests.factories import PlaylistFactory
from spotivore.music.tests.factories import TrackFactory
from spotivore.music.tests.factories import TrackInPlaylistFactory

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Track
# ---------------------------------------------------------------------------


def test_track_spotify_id_must_be_unique():
    TrackFactory(spotify_id="abcdefghijklmnopqrstuv")
    with pytest.raises(IntegrityError):
        Track.objects.create(spotify_id="abcdefghijklmnopqrstuv")


def test_track_spotify_id_validator_rejects_invalid_format():
    track = Track(spotify_id="too-short!")
    with pytest.raises(ValidationError):
        track.full_clean()


def test_track_str_returns_name_when_set():
    track = TrackFactory(name="My Song")
    assert str(track) == "My Song"


def test_track_str_returns_spotify_id_when_name_blank():
    track = TrackFactory(spotify_id="abcdefghijklmnopqrstuv", name="")
    assert str(track) == "abcdefghijklmnopqrstuv"


# ---------------------------------------------------------------------------
# Playlist
# ---------------------------------------------------------------------------


def test_playlist_unique_per_owner():
    playlist = PlaylistFactory(spotify_id="1234567890123456789012")

    with pytest.raises(IntegrityError):
        Playlist.objects.create(
            owner=playlist.owner,
            spotify_id=playlist.spotify_id,
        )


def test_playlist_id_can_repeat_for_different_users():
    first = PlaylistFactory(spotify_id="1234567890123456789012")
    second = PlaylistFactory(spotify_id="1234567890123456789012")

    assert first.spotify_id == second.spotify_id
    assert first.owner_id != second.owner_id


def test_playlist_str_returns_name_when_set():
    playlist = PlaylistFactory(name="Road Trip")
    assert str(playlist) == "Road Trip"


def test_playlist_str_returns_spotify_id_when_name_blank():
    playlist = PlaylistFactory(spotify_id="abcdefghijklmnopqrstuv", name="")
    assert str(playlist) == "abcdefghijklmnopqrstuv"


# ---------------------------------------------------------------------------
# TrackInPlaylist
# ---------------------------------------------------------------------------


def test_track_entries_order_by_position():
    later = TrackInPlaylistFactory(position=2)
    earlier = TrackInPlaylistFactory(playlist=later.playlist, position=1)

    positions = list(later.playlist.entries.values_list("position", flat=True))

    assert positions == [1, 2]


def test_track_in_playlist_unique_position():
    entry = TrackInPlaylistFactory(position=0)
    with pytest.raises(IntegrityError):
        TrackInPlaylist.objects.create(
            playlist=entry.playlist,
            track=TrackFactory(),
            position=0,
        )


def test_track_in_playlist_str():
    entry = TrackInPlaylistFactory(position=3)
    assert str(entry) == f"{entry.playlist_id}:3"


def test_deleting_track_cascades_to_entries():
    entry = TrackInPlaylistFactory()
    track = entry.track
    track.delete()
    assert not TrackInPlaylist.objects.filter(pk=entry.pk).exists()


def test_deleting_playlist_cascades_to_entries():
    entry = TrackInPlaylistFactory()
    playlist = entry.playlist
    playlist.delete()
    assert not TrackInPlaylist.objects.filter(pk=entry.pk).exists()


# ---------------------------------------------------------------------------
# ListeningSession
# ---------------------------------------------------------------------------


def test_listening_session_unique_per_owner_and_playlist():
    session = ListeningSessionFactory()
    with pytest.raises(IntegrityError):
        ListeningSession.objects.create(
            owner=session.owner,
            playlist_spotify_id=session.playlist_spotify_id,
            current_track_uri="spotify:track:something",
        )
