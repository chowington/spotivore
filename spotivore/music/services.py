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

    # Resolve tracks — fetch existing in one query, bulk-create new ones.
    input_spotify_ids = [t["spotify_id"] for t in tracks]
    track_map: dict[str, Track] = {
        t.spotify_id: t
        for t in Track.objects.filter(spotify_id__in=input_spotify_ids)
    }

    tracks_to_create: list[Track] = []
    tracks_to_update: list[Track] = []
    track_update_fields: set[str] = set()

    for track_data in tracks:
        sid = track_data["spotify_id"]
        existing = track_map.get(sid)
        if existing is None:
            tracks_to_create.append(Track(
                spotify_id=sid,
                name=track_data.get("name", ""),
                artists=track_data.get("artists", []),
                album=track_data.get("album", ""),
                uri=track_data.get("uri", ""),
            ))
        else:
            changed: list[str] = []
            for field in ("name", "album", "uri"):
                val = track_data.get(field, "")
                if val and getattr(existing, field) != val:
                    setattr(existing, field, val)
                    changed.append(field)
            artists = track_data.get("artists", [])
            if artists and existing.artists != artists:
                existing.artists = artists
                changed.append("artists")
            if changed:
                tracks_to_update.append(existing)
                track_update_fields.update(changed)

    if tracks_to_create:
        for t in Track.objects.bulk_create(tracks_to_create):
            track_map[t.spotify_id] = t
    if tracks_to_update:
        Track.objects.bulk_update(tracks_to_update, list(track_update_fields))

    # Sync TrackInPlaylist entries.
    existing_entries: dict[int, TrackInPlaylist] = {
        entry.position: entry
        for entry in playlist.entries.select_related("track")
    }

    entries_to_create: list[TrackInPlaylist] = []
    entries_to_update: list[TrackInPlaylist] = []
    seen_positions: set[int] = set()

    with transaction.atomic():
        for track_data in tracks:
            position = track_data["position"]
            seen_positions.add(position)
            track = track_map[track_data["spotify_id"]]
            entry = existing_entries.get(position)

            if entry is None:
                entries_to_create.append(TrackInPlaylist(
                    playlist=playlist,
                    track=track,
                    position=position,
                ))
            elif entry.track_id != track.id:
                entry.track = track
                entry.sublist = None
                entries_to_update.append(entry)

        if entries_to_create:
            TrackInPlaylist.objects.bulk_create(entries_to_create)
        if entries_to_update:
            TrackInPlaylist.objects.bulk_update(entries_to_update, ["track", "sublist"])

        playlist.entries.exclude(position__in=seen_positions).delete()

    playlist.refresh_from_db()
    return playlist
