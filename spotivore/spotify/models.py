from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class SpotifyConnection(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="spotify_connection",
    )
    spotify_user_id = models.CharField(max_length=255, unique=True)
    display_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    access_token = models.TextField()
    refresh_token = models.TextField()
    token_type = models.CharField(max_length=32, default="Bearer")
    scope = models.TextField(blank=True)
    expires_at = models.DateTimeField()
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username"]

    def __str__(self) -> str:
        return f"{self.user.username} -> {self.spotify_user_id}"

    @property
    def scopes(self) -> list[str]:
        return [scope for scope in self.scope.split() if scope]

    def is_expired(self, leeway_seconds: int = 0) -> bool:
        return self.expires_at <= timezone.now() + timedelta(seconds=leeway_seconds)

