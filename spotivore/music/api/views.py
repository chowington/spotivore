from django.core.exceptions import ImproperlyConfigured
from rest_framework import mixins
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from spotivore.music.models import ListeningSession
from spotivore.music.models import Playlist
from spotivore.music.models import TrackInPlaylist
from spotivore.spotify.models import SpotifyConnection
from spotivore.spotify.services import SpotifyAPIError
from spotivore.spotify.services import SpotifyOAuthService

from spotivore.music.services import sync_playlist

from .serializers import ListeningSessionSerializer
from .serializers import PlaylistDetailSerializer
from .serializers import PlaylistSerializer
from .serializers import PlaylistSublistSerializer
from .serializers import PlaylistTrackEntrySerializer


class PlaylistViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = PlaylistSerializer
    lookup_field = "spotify_id"
    queryset = Playlist.objects.all()

    def get_queryset(self):
        return (
            self.queryset.filter(owner=self.request.user)
            .select_related("owner")
            .prefetch_related("entries__track", "entries__sublist")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PlaylistDetailSerializer
        if self.action == "sublists" and self.request.method == "POST":
            return PlaylistSublistSerializer
        return super().get_serializer_class()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def tracks(self, request, spotify_id=None):
        playlist = self.get_queryset().filter(spotify_id=spotify_id).first()

        try:
            connection = request.user.spotify_connection
        except SpotifyConnection.DoesNotExist:
            connection = None

        if connection is None:
            return Response(
                {"detail": "Spotify account not connected."},
                status=status.HTTP_404_NOT_FOUND,
            )

        service = SpotifyOAuthService.from_settings()
        try:
            tracks_data = service.get_playlist_tracks(connection, spotify_id)
        except ImproperlyConfigured as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except SpotifyAPIError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        if playlist is not None:
            sync_playlist(
                user=request.user,
                spotify_id=spotify_id,
                name=playlist.name,
                tracks=tracks_data,
            )

        return Response(tracks_data)

    @action(detail=True, methods=["get", "post"])
    def sublists(self, request, spotify_id=None):
        playlist = self.get_object()

        if request.method == "GET":
            serializer = PlaylistTrackEntrySerializer(
                playlist.entries.filter(sublist__isnull=False),
                many=True,
            )
            return Response(serializer.data)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        if validated_data["sublist_spotify_id"] == playlist.spotify_id:
            return Response(
                {
                    "sublist_spotify_id": [
                        "A playlist cannot reference itself as a sublist."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            entry = playlist.entries.get(position=validated_data["position"])
        except TrackInPlaylist.DoesNotExist:
            return Response(
                {"position": ["No track exists at this position."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sublist, _ = Playlist.objects.get_or_create(
            owner=request.user,
            spotify_id=validated_data["sublist_spotify_id"],
            defaults={"name": validated_data.get("sublist_name", "")},
        )
        sublist_name = validated_data.get("sublist_name", "")
        if sublist_name and sublist.name != sublist_name:
            sublist.name = sublist_name
            sublist.save(update_fields=["name"])

        entry.sublist = sublist
        entry.save(update_fields=["sublist"])

        return Response(
            PlaylistTrackEntrySerializer(entry).data,
            status=status.HTTP_200_OK,
        )


class ListeningSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, playlist_spotify_id):
        try:
            session = ListeningSession.objects.get(owner=request.user, playlist_spotify_id=playlist_spotify_id)
        except ListeningSession.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(ListeningSessionSerializer(session).data)

    def put(self, request, playlist_spotify_id):
        serializer = ListeningSessionSerializer(data={**request.data, "playlist_spotify_id": playlist_spotify_id})
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        ListeningSession.objects.update_or_create(
            owner=request.user,
            playlist_spotify_id=playlist_spotify_id,
            defaults={
                "current_track_uri": d["current_track_uri"],
                "position_ms": d["position_ms"],
                "track_uris": d["track_uris"],
            },
        )
        return Response(status=status.HTTP_200_OK)
