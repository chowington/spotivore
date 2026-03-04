import pytest
from django.db import IntegrityError

from spotivore.music.models import Playlist
from spotivore.music.tests.factories import PlaylistFactory
from spotivore.music.tests.factories import TrackInPlaylistFactory

pytestmark = pytest.mark.django_db


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


def test_track_entries_order_by_position():
    later = TrackInPlaylistFactory(position=2)
    earlier = TrackInPlaylistFactory(playlist=later.playlist, position=1)

    positions = list(later.playlist.entries.values_list("position", flat=True))

    assert positions == [1, 2]
