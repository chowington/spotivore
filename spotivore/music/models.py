from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

spotify_id_validator = RegexValidator(
    regex=r"^[A-Za-z0-9]{22}$",
    message="Spotify IDs must be 22 alphanumeric characters.",
)


class Track(models.Model):
    spotify_id = models.CharField(
        max_length=22,
        unique=True,
        validators=[spotify_id_validator],
    )
    name = models.CharField(max_length=255, blank=True)
    artists = models.JSONField(default=list)
    album = models.CharField(max_length=255, blank=True)
    uri = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["spotify_id"]

    def __str__(self) -> str:
        return self.name or self.spotify_id


class Playlist(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="playlists",
    )
    spotify_id = models.CharField(
        max_length=22,
        validators=[spotify_id_validator],
    )
    name = models.CharField(max_length=255, blank=True)
    tracks = models.ManyToManyField(
        Track,
        through="TrackInPlaylist",
        through_fields=("playlist", "track"),
        related_name="playlists",
    )

    class Meta:
        ordering = ["name", "spotify_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "spotify_id"],
                name="unique_owner_playlist_spotify_id",
            ),
        ]

    def __str__(self) -> str:
        return self.name or self.spotify_id


class TrackInPlaylist(models.Model):
    track = models.ForeignKey(
        Track,
        on_delete=models.CASCADE,
        related_name="playlist_entries",
    )
    playlist = models.ForeignKey(
        Playlist,
        on_delete=models.CASCADE,
        related_name="entries",
    )
    position = models.PositiveIntegerField()
    sublist = models.ForeignKey(
        Playlist,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="embedded_entries",
    )

    class Meta:
        ordering = ["playlist", "position"]
        constraints = [
            models.UniqueConstraint(
                fields=["playlist", "position"],
                name="unique_position_in_playlist",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.playlist_id}:{self.position}"
