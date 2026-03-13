from django.contrib.auth import get_user_model
from django.db import transaction

from spotivore.music.models import Playlist
from spotivore.music.models import Track
from spotivore.music.models import TrackInPlaylist

User = get_user_model()


def sync_playlist(
    user: User,
    spotify_id: str,
    name: str,
    tracks: list[dict],
) -> Playlist:
    """Create or update a local Playlist with the given tracks.

    Intended to be called by feature endpoints that require a playlist to exist
    in the local DB. Callers are responsible for fetching track data from the
    Spotify API beforehand.

    Each dict in ``tracks`` should have the shape returned by
    ``SpotifyOAuthService.get_playlist_tracks``::

        {
            "position": int,
            "spotify_id": str,
            "name": str,
            "artists": list[str],
            "album": str,
            "uri": str,
        }

    Returns the updated Playlist instance.
    """
    playlist, _ = Playlist.objects.get_or_create(
        owner=user,
        spotify_id=spotify_id,
        defaults={"name": name},
    )
    if name and playlist.name != name:
        playlist.name = name
        playlist.save(update_fields=["name"])

    existing_entries = {
        entry.position: entry
        for entry in playlist.entries.select_related("track")
    }
    seen_positions: set[int] = set()

    with transaction.atomic():
        for track_data in tracks:
            position = track_data["position"]
            seen_positions.add(position)

            track, _ = Track.objects.get_or_create(
                spotify_id=track_data["spotify_id"],
                defaults={
                    "name": track_data.get("name", ""),
                    "artists": track_data.get("artists", []),
                    "album": track_data.get("album", ""),
                    "uri": track_data.get("uri", ""),
                },
            )

            track_update_fields: list[str] = []
            for field in ("name", "album", "uri"):
                val = track_data.get(field, "")
                if val and getattr(track, field) != val:
                    setattr(track, field, val)
                    track_update_fields.append(field)
            artists = track_data.get("artists", [])
            if artists and track.artists != artists:
                track.artists = artists
                track_update_fields.append("artists")
            if track_update_fields:
                track.save(update_fields=track_update_fields)

            entry = existing_entries.get(position)
            if entry is None:
                TrackInPlaylist.objects.create(
                    playlist=playlist,
                    track=track,
                    position=position,
                )
            else:
                entry_update_fields: list[str] = []
                if entry.track_id != track.id:
                    entry.track = track
                    entry.sublist = None
                    entry_update_fields.extend(["track", "sublist"])
                if entry_update_fields:
                    entry.save(update_fields=entry_update_fields)

        playlist.entries.exclude(position__in=seen_positions).delete()

    playlist.refresh_from_db()
    return playlist
