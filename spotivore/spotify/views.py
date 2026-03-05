from urllib.parse import parse_qsl
from urllib.parse import urlencode
from urllib.parse import urlsplit
from urllib.parse import urlunsplit

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError
from django.http import HttpRequest
from django.http import HttpResponseRedirect
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import View

from spotivore.spotify.constants import SPOTIFY_OAUTH_NEXT_SESSION_KEY
from spotivore.spotify.constants import SPOTIFY_OAUTH_STATE_SESSION_KEY
from spotivore.spotify.models import SpotifyConnection
from spotivore.spotify.services import SpotifyAPIError
from spotivore.spotify.services import SpotifyOAuthService


def get_spotify_oauth_service() -> SpotifyOAuthService:
    return SpotifyOAuthService.from_settings()


def with_query_params(url: str, **params: str) -> str:
    parts = list(urlsplit(url))
    query = dict(parse_qsl(parts[3], keep_blank_values=True))
    for key, value in params.items():
        if value:
            query[key] = value
    parts[3] = urlencode(query)
    return urlunsplit(parts)


def get_success_redirect_url(request: HttpRequest) -> str:
    fallback_url = settings.SPOTIFY_AUTH_SUCCESS_URL
    next_url = request.session.pop(SPOTIFY_OAUTH_NEXT_SESSION_KEY, fallback_url)
    if url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
        return next_url
    return fallback_url


def get_failure_redirect_url(request: HttpRequest) -> str:
    return settings.SPOTIFY_AUTH_FAILURE_URL


class SpotifyCallbackView(View):
    def get(self, request):
        failure_url = get_failure_redirect_url(request)
        if not request.user.is_authenticated:
            return HttpResponseRedirect(
                with_query_params(failure_url, spotify_error="authentication_required"),
            )

        error = request.GET.get("error")
        if error:
            request.session.pop(SPOTIFY_OAUTH_STATE_SESSION_KEY, None)
            request.session.pop(SPOTIFY_OAUTH_NEXT_SESSION_KEY, None)
            return HttpResponseRedirect(with_query_params(failure_url, spotify_error=error))

        expected_state = request.session.pop(SPOTIFY_OAUTH_STATE_SESSION_KEY, None)
        state = request.GET.get("state")
        code = request.GET.get("code")
        if not expected_state or state != expected_state or not code:
            request.session.pop(SPOTIFY_OAUTH_NEXT_SESSION_KEY, None)
            return HttpResponseRedirect(
                with_query_params(failure_url, spotify_error="invalid_state"),
            )

        service = get_spotify_oauth_service()
        success_url = get_success_redirect_url(request)
        try:
            redirect_uri = service.build_redirect_uri(request)
            token_payload = service.exchange_code_for_tokens(
                code=code,
                redirect_uri=redirect_uri,
            )
            profile_payload = service.fetch_current_user_profile(token_payload["access_token"])
            if (
                SpotifyConnection.objects.filter(spotify_user_id=profile_payload["id"])
                .exclude(user=request.user)
                .exists()
            ):
                return HttpResponseRedirect(
                    with_query_params(failure_url, spotify_error="account_already_connected"),
                )
            defaults = service.build_connection_defaults(token_payload, profile_payload)
            existing_refresh_token = (
                SpotifyConnection.objects.filter(user=request.user)
                .values_list("refresh_token", flat=True)
                .first()
            )
            if not defaults["refresh_token"] and existing_refresh_token:
                defaults["refresh_token"] = existing_refresh_token
            SpotifyConnection.objects.update_or_create(
                user=request.user,
                defaults=defaults,
            )
        except (ImproperlyConfigured, IntegrityError, KeyError, SpotifyAPIError):
            return HttpResponseRedirect(
                with_query_params(failure_url, spotify_error="callback_failed"),
            )

        return HttpResponseRedirect(with_query_params(success_url, spotify="connected"))
