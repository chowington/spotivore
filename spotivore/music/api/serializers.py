from rest_framework import serializers

from spotivore.music.models import ListeningSession
from spotivore.music.models import Playlist
from spotivore.music.models import Track
from spotivore.music.models import TrackInPlaylist


class TrackSerializer(serializers.ModelSerializer[Track]):
    class Meta:
        model = Track
        fields = ["spotify_id", "name", "artists", "album", "uri"]


class PlaylistTrackEntrySerializer(serializers.ModelSerializer[TrackInPlaylist]):
    track = TrackSerializer(read_only=True)
    sublist_spotify_id = serializers.CharField(
        source="sublist.spotify_id",
        read_only=True,
    )
    sublist_name = serializers.CharField(
        source="sublist.name",
        read_only=True,
    )

    class Meta:
        model = TrackInPlaylist
        fields = ["position", "track", "sublist_spotify_id", "sublist_name"]


class PlaylistSerializer(serializers.HyperlinkedModelSerializer[Playlist]):
    track_count = serializers.IntegerField(source="entries.count", read_only=True)

    class Meta:
        model = Playlist
        fields = ["url", "spotify_id", "name", "track_count"]
        extra_kwargs = {
            "url": {
                "view_name": "api:playlist-detail",
                "lookup_field": "spotify_id",
            },
        }


class PlaylistDetailSerializer(PlaylistSerializer):
    entries = PlaylistTrackEntrySerializer(many=True, read_only=True)

    class Meta(PlaylistSerializer.Meta):
        fields = [*PlaylistSerializer.Meta.fields, "entries"]


class ListeningSessionSerializer(serializers.ModelSerializer[ListeningSession]):
    class Meta:
        model = ListeningSession
        fields = [
            "playlist_spotify_id",
            "current_track_uri",
            "position_ms",
            "track_uris",
            "shuffled",
        ]


class PlaylistSublistSerializer(serializers.Serializer):
    position = serializers.IntegerField(min_value=0)
    sublist_spotify_id = serializers.RegexField(r"^[A-Za-z0-9]{22}$")
    sublist_name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )
