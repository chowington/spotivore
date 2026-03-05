import datetime

from rest_framework import serializers

from spotivore.spotify.models import SpotifyConnection


class SpotifyAuthorizeURLSerializer(serializers.Serializer):
    authorize_url = serializers.URLField()


class SpotifyConnectionSerializer(serializers.ModelSerializer):
    connected = serializers.SerializerMethodField()
    scopes = serializers.SerializerMethodField()
    expires_at = serializers.DateTimeField(default_timezone=datetime.timezone.utc)

    class Meta:
        model = SpotifyConnection
        fields = [
            "connected",
            "spotify_user_id",
            "display_name",
            "email",
            "scopes",
            "expires_at",
        ]

    def get_connected(self, obj: SpotifyConnection) -> bool:
        return True

    def get_scopes(self, obj: SpotifyConnection) -> list[str]:
        return obj.scopes


class SpotifyPlaylistSerializer(serializers.Serializer):
    spotify_id = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    owner_name = serializers.CharField(allow_blank=True)
    is_public = serializers.BooleanField(allow_null=True)
    track_count = serializers.IntegerField(min_value=0)


class SpotifyPlaylistTrackSerializer(serializers.Serializer):
    position = serializers.IntegerField(min_value=0)
    spotify_id = serializers.CharField()
    name = serializers.CharField(allow_blank=True)
    artists = serializers.ListField(child=serializers.CharField())
    album = serializers.CharField(allow_blank=True)
    uri = serializers.CharField(allow_blank=True)

