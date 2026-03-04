from datetime import timedelta

import factory
from django.utils import timezone

from spotivore.spotify.models import SpotifyConnection
from spotivore.users.tests.factories import UserFactory


class SpotifyConnectionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = SpotifyConnection

    user = factory.SubFactory(UserFactory)
    spotify_user_id = factory.Sequence(lambda n: f"spotify-user-{n}")
    display_name = factory.Sequence(lambda n: f"Spotify User {n}")
    email = factory.Sequence(lambda n: f"spotify{n}@example.com")
    access_token = factory.Sequence(lambda n: f"access-token-{n}")
    refresh_token = factory.Sequence(lambda n: f"refresh-token-{n}")
    token_type = "Bearer"
    scope = "playlist-read-private user-read-email"
    expires_at = factory.LazyFunction(lambda: timezone.now() + timedelta(hours=1))

