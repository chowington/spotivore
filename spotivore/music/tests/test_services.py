import pytest

from spotivore.music.models import Playlist
from spotivore.music.models import Track
from spotivore.music.services import sync_playlist
from spotivore.music.tests.factories import PlaylistFactory
from spotivore.music.tests.factories import TrackFactory
from spotivore.music.tests.factories import TrackInPlaylistFactory
from spotivore.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def make_track_data(position, spotify_id, name="Track", artists=None, album="", uri=""):  # noqa: PLR0913
    return {
        "position": position,
        "spotify_id": spotify_id,
        "name": name,
        "artists": artists if artists is not None else [],
        "album": album,
        "uri": uri,
    }


# ---------------------------------------------------------------------------
# Playlist creation / update
# ---------------------------------------------------------------------------


def test_creates_playlist_when_not_exists():
    user = UserFactory()
    result = sync_playlist(user, "abcdefghijklmnopqrstuv", "My Playlist", [])
    assert Playlist.objects.filter(
        owner=user,
        spotify_id="abcdefghijklmnopqrstuv",
    ).exists()
    assert result.name == "My Playlist"


def test_returns_existing_playlist_without_duplicate():
    user = UserFactory()
    PlaylistFactory(owner=user, spotify_id="abcdefghijklmnopqrstuv", name="Old Name")
    sync_playlist(user, "abcdefghijklmnopqrstuv", "Old Name", [])
    assert (
        Playlist.objects.filter(owner=user, spotify_id="abcdefghijklmnopqrstuv").count()
        == 1
    )


def test_updates_playlist_name_when_changed():
    user = UserFactory()
    playlist = PlaylistFactory(
        owner=user,
        spotify_id="abcdefghijklmnopqrstuv",
        name="Old Name",
    )
    sync_playlist(user, playlist.spotify_id, "New Name", [])
    playlist.refresh_from_db()
    assert playlist.name == "New Name"


def test_does_not_update_playlist_name_when_empty_string():
    user = UserFactory()
    playlist = PlaylistFactory(
        owner=user,
        spotify_id="abcdefghijklmnopqrstuv",
        name="Keep Me",
    )
    sync_playlist(user, playlist.spotify_id, "", [])
    playlist.refresh_from_db()
    assert playlist.name == "Keep Me"


# ---------------------------------------------------------------------------
# Track creation
# ---------------------------------------------------------------------------


def test_creates_new_tracks():
    user = UserFactory()
    tracks = [make_track_data(0, "abcdefghijklmnopqrstuv", "Song A")]
    sync_playlist(user, "1234567890123456789012", "Playlist", tracks)
    assert Track.objects.filter(
        spotify_id="abcdefghijklmnopqrstuv",
        name="Song A",
    ).exists()


def test_does_not_duplicate_existing_track():
    user = UserFactory()
    track = TrackFactory(spotify_id="abcdefghijklmnopqrstuv", name="Existing")
    tracks = [make_track_data(0, track.spotify_id, "Existing")]
    sync_playlist(user, "1234567890123456789012", "Playlist", tracks)
    assert Track.objects.filter(spotify_id=track.spotify_id).count() == 1


def test_new_track_has_correct_fields():
    user = UserFactory()
    tracks = [
        make_track_data(
            0,
            "abcdefghijklmnopqrstuv",
            "Song",
            ["Artist A"],
            "Album X",
            "spotify:track:abc",
        ),
    ]
    sync_playlist(user, "1234567890123456789012", "Playlist", tracks)
    track = Track.objects.get(spotify_id="abcdefghijklmnopqrstuv")
    assert track.name == "Song"
    assert track.artists == ["Artist A"]
    assert track.album == "Album X"
    assert track.uri == "spotify:track:abc"


# ---------------------------------------------------------------------------
# Track update
# ---------------------------------------------------------------------------


def test_updates_existing_track_name():
    user = UserFactory()
    track = TrackFactory(spotify_id="abcdefghijklmnopqrstuv", name="Old Name")
    tracks = [make_track_data(0, track.spotify_id, "New Name")]
    sync_playlist(user, "1234567890123456789012", "Playlist", tracks)
    track.refresh_from_db()
    assert track.name == "New Name"


def test_updates_existing_track_album():
    user = UserFactory()
    track = TrackFactory(spotify_id="abcdefghijklmnopqrstuv", album="Old Album")
    tracks = [make_track_data(0, track.spotify_id, track.name, album="New Album")]
    sync_playlist(user, "1234567890123456789012", "Playlist", tracks)
    track.refresh_from_db()
    assert track.album == "New Album"


def test_updates_existing_track_artists():
    user = UserFactory()
    track = TrackFactory(spotify_id="abcdefghijklmnopqrstuv", artists=["Old Artist"])
    tracks = [make_track_data(0, track.spotify_id, track.name, artists=["New Artist"])]
    sync_playlist(user, "1234567890123456789012", "Playlist", tracks)
    track.refresh_from_db()
    assert track.artists == ["New Artist"]


def test_does_not_overwrite_field_with_empty_value():
    user = UserFactory()
    track = TrackFactory(spotify_id="abcdefghijklmnopqrstuv", name="Keep Me")
    tracks = [make_track_data(0, track.spotify_id, "")]  # empty name
    sync_playlist(user, "1234567890123456789012", "Playlist", tracks)
    track.refresh_from_db()
    assert track.name == "Keep Me"


# ---------------------------------------------------------------------------
# TrackInPlaylist entry sync
# ---------------------------------------------------------------------------


def test_creates_entries_for_all_positions():
    user = UserFactory()
    tracks = [
        make_track_data(0, "abcdefghijklmnopqrstuv"),
        make_track_data(1, "bcdefghijklmnopqrstuvw"),
    ]
    sync_playlist(user, "1234567890123456789012", "Playlist", tracks)
    playlist = Playlist.objects.get(owner=user, spotify_id="1234567890123456789012")
    assert list(playlist.entries.values_list("position", flat=True)) == [0, 1]


def test_updates_entry_track_when_position_changes():
    user = UserFactory()
    playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
    entry = TrackInPlaylistFactory(playlist=playlist, position=0)
    new_track_id = "abcdefghijklmnopqrstuv"
    tracks = [make_track_data(0, new_track_id, "New Track")]
    sync_playlist(user, playlist.spotify_id, playlist.name, tracks)
    entry.refresh_from_db()
    assert entry.track.spotify_id == new_track_id


def test_clears_sublist_when_track_replaced():
    user = UserFactory()
    playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
    sublist = PlaylistFactory(owner=user)
    entry = TrackInPlaylistFactory(playlist=playlist, position=0, sublist=sublist)
    tracks = [make_track_data(0, "abcdefghijklmnopqrstuv", "Replacement")]
    sync_playlist(user, playlist.spotify_id, playlist.name, tracks)
    entry.refresh_from_db()
    assert entry.sublist is None


def test_does_not_update_unchanged_entry():
    user = UserFactory()
    playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
    track = TrackFactory(spotify_id="abcdefghijklmnopqrstuv")
    entry = TrackInPlaylistFactory(playlist=playlist, position=0, track=track)
    tracks = [make_track_data(0, track.spotify_id)]
    sync_playlist(user, playlist.spotify_id, playlist.name, tracks)
    entry.refresh_from_db()
    assert entry.track_id == track.id


def test_deletes_entries_not_in_new_tracks():
    user = UserFactory()
    playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
    TrackInPlaylistFactory(playlist=playlist, position=0)
    TrackInPlaylistFactory(playlist=playlist, position=1)
    tracks = [make_track_data(0, "abcdefghijklmnopqrstuv")]
    sync_playlist(user, playlist.spotify_id, playlist.name, tracks)
    assert not playlist.entries.filter(position=1).exists()
    assert playlist.entries.filter(position=0).exists()


def test_empty_tracks_removes_all_entries():
    user = UserFactory()
    playlist = PlaylistFactory(owner=user, spotify_id="1234567890123456789012")
    TrackInPlaylistFactory(playlist=playlist, position=0)
    TrackInPlaylistFactory(playlist=playlist, position=1)
    sync_playlist(user, playlist.spotify_id, playlist.name, [])
    assert playlist.entries.count() == 0


def test_returns_playlist_instance():
    user = UserFactory()
    result = sync_playlist(user, "abcdefghijklmnopqrstuv", "My Playlist", [])
    assert isinstance(result, Playlist)
