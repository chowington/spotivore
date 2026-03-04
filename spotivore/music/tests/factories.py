import factory

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
