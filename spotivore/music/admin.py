from django.contrib import admin

from .models import Playlist
from .models import Track
from .models import TrackInPlaylist


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ["spotify_id", "name"]
    search_fields = ["spotify_id", "name"]


class TrackInPlaylistInline(admin.TabularInline):
    model = TrackInPlaylist
    fk_name = "playlist"
    extra = 0
    autocomplete_fields = ["track", "sublist"]
    ordering = ["position"]


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ["spotify_id", "name", "owner"]
    list_select_related = ["owner"]
    search_fields = ["spotify_id", "name", "owner__username"]
    autocomplete_fields = ["owner"]
    inlines = [TrackInPlaylistInline]


@admin.register(TrackInPlaylist)
class TrackInPlaylistAdmin(admin.ModelAdmin):
    list_display = ["playlist", "position", "track", "sublist"]
    list_select_related = ["playlist", "track", "sublist"]
    autocomplete_fields = ["playlist", "track", "sublist"]
