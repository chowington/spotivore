from django.core.exceptions import ImproperlyConfigured
from django.utils.crypto import get_random_string
from django.utils.http import url_has_allowed_host_and_scheme
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from spotivore.spotify.api.serializers import SpotifyAuthorizeURLSerializer
from spotivore.spotify.api.serializers import SpotifyConnectionSerializer
from spotivore.spotify.api.serializers import SpotifyPlaylistSerializer
from spotivore.spotify.api.serializers import SpotifyPlaylistTrackSerializer
from spotivore.spotify.constants import SPOTIFY_OAUTH_NEXT_SESSION_KEY
from spotivore.spotify.constants import SPOTIFY_OAUTH_STATE_SESSION_KEY
from spotivore.spotify.models import SpotifyConnection
from spotivore.spotify.services import SpotifyAPIError
from spotivore.spotify.services import SpotifyOAuthService


def get_spotify_oauth_service() -> SpotifyOAuthService:
    return SpotifyOAuthService.from_settings()


def get_connection_for_user(user) -> SpotifyConnection:
    try:
        return user.spotify_connection
    except SpotifyConnection.DoesNotExist as exc:
        raise NotFound("Spotify account not connected.") from exc


class SpotifyAuthURLView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        service = get_spotify_oauth_service()
        try:
            redirect_uri = service.build_redirect_uri(request)
            state = get_random_string(32)
            authorize_url = service.build_authorize_url(
                state=state,
                redirect_uri=redirect_uri,
            )
        except ImproperlyConfigured as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        request.session[SPOTIFY_OAUTH_STATE_SESSION_KEY] = state
        next_url = request.query_params.get("next", "")
        if next_url and url_has_allowed_host_and_scheme(
            next_url,
            allowed_hosts={request.get_host()},
        ):
            request.session[SPOTIFY_OAUTH_NEXT_SESSION_KEY] = next_url
        else:
            request.session.pop(SPOTIFY_OAUTH_NEXT_SESSION_KEY, None)

        serializer = SpotifyAuthorizeURLSerializer({"authorize_url": authorize_url})
        return Response(serializer.data)


class SpotifyConnectionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        connection = SpotifyConnection.objects.filter(user=request.user).first()
        if connection is None:
            return Response({"connected": False})
        serializer = SpotifyConnectionSerializer(connection)
        return Response(serializer.data)

    def delete(self, request):
        SpotifyConnection.objects.filter(user=request.user).delete()
        request.session.pop(SPOTIFY_OAUTH_STATE_SESSION_KEY, None)
        request.session.pop(SPOTIFY_OAUTH_NEXT_SESSION_KEY, None)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SpotifyPlaylistListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        connection = get_connection_for_user(request.user)
        service = get_spotify_oauth_service()
        try:
            playlists = service.get_current_user_playlists(connection)
        except ImproperlyConfigured as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except SpotifyAPIError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        serializer = SpotifyPlaylistSerializer(playlists, many=True)
        return Response(serializer.data)


class SpotifyPlaylistTracksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, spotify_id: str):
        if len(spotify_id) != 22 or not spotify_id.isalnum():
            raise ValidationError(
                {"spotify_id": ["Spotify IDs must be 22 alphanumeric characters."]}
            )

        connection = get_connection_for_user(request.user)
        service = get_spotify_oauth_service()
        try:
            tracks = service.get_playlist_tracks(connection, spotify_id)
        except ImproperlyConfigured as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except SpotifyAPIError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        serializer = SpotifyPlaylistTrackSerializer(tracks, many=True)
        return Response(serializer.data)
