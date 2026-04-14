import factory

from spotivore.music.models import ListeningSession
from spotivore.music.models import Playlist
from spotivore.music.models import Track
from spotivore.music.models import TrackInPlaylist
from spotivore.users.tests.factories import UserFactory


class TrackFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Track

    spotify_id = factory.Sequence(lambda n: f"{n:022d}")
    name = factory.Sequence(lambda n: f"Track {n}")


class PlaylistFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Playlist

    owner = factory.SubFactory(UserFactory)
    spotify_id = factory.Sequence(lambda n: f"{n:022d}")
    name = factory.Sequence(lambda n: f"Playlist {n}")


class TrackInPlaylistFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = TrackInPlaylist

    track = factory.SubFactory(TrackFactory)
    playlist = factory.SubFactory(PlaylistFactory)
    position = factory.Sequence(lambda n: n)
    sublist = None


class ListeningSessionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ListeningSession

    owner = factory.SubFactory(UserFactory)
    playlist_spotify_id = factory.Sequence(lambda n: f"S{n:021d}")
    current_track_uri = factory.Sequence(lambda n: f"spotify:track:{n:022d}")
    position_ms = 0
    track_uris = factory.LazyFunction(list)
