from django.db import transaction
from rest_framework import mixins
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from spotivore.music.models import Playlist
from spotivore.music.models import Track
from spotivore.music.models import TrackInPlaylist

from .serializers import PlaylistDetailSerializer
from .serializers import PlaylistSerializer
from .serializers import PlaylistSublistSerializer
from .serializers import PlaylistSyncSerializer
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
        if self.action == "sync":
            return PlaylistSyncSerializer
        if self.action == "sublists" and self.request.method == "POST":
            return PlaylistSublistSerializer
        return super().get_serializer_class()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["post"])
    def sync(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        playlist, _ = Playlist.objects.get_or_create(
            owner=request.user,
            spotify_id=validated_data["spotify_id"],
            defaults={"name": validated_data.get("name", "")},
        )

        if "name" in validated_data and playlist.name != validated_data["name"]:
            playlist.name = validated_data["name"]
            playlist.save(update_fields=["name"])

        existing_entries = {
            entry.position: entry
            for entry in playlist.entries.select_related("track", "sublist")
        }
        seen_positions: set[int] = set()

        with transaction.atomic():
            for position, track_data in enumerate(validated_data["tracks"]):
                seen_positions.add(position)
                track, _ = Track.objects.get_or_create(
                    spotify_id=track_data["spotify_id"],
                    defaults={"name": track_data.get("name", "")},
                )

                track_name = track_data.get("name", "")
                if track_name and track.name != track_name:
                    track.name = track_name
                    track.save(update_fields=["name"])

                entry = existing_entries.get(position)
                if entry is None:
                    TrackInPlaylist.objects.create(
                        playlist=playlist,
                        track=track,
                        position=position,
                    )
                    continue

                updated_fields: list[str] = []
                if entry.track_id != track.id:
                    entry.track = track
                    entry.sublist = None
                    updated_fields.extend(["track", "sublist"])
                if entry.position != position:
                    entry.position = position
                    updated_fields.append("position")
                if updated_fields:
                    entry.save(update_fields=updated_fields)

            playlist.entries.exclude(position__in=seen_positions).delete()

        playlist.refresh_from_db()
        playlist = self.get_queryset().get(pk=playlist.pk)
        return Response(
            PlaylistDetailSerializer(playlist, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

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
