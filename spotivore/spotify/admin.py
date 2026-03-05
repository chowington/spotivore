from django.contrib import admin

from spotivore.spotify.models import SpotifyConnection


@admin.register(SpotifyConnection)
class SpotifyConnectionAdmin(admin.ModelAdmin):
    list_display = ["user", "spotify_user_id", "display_name", "expires_at", "modified"]
    search_fields = ["user__username", "spotify_user_id", "display_name", "email"]
    list_select_related = ["user"]
