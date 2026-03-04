from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from spotivore.music.api.views import PlaylistViewSet
from spotivore.users.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("playlists", PlaylistViewSet, basename="playlist")
router.register("users", UserViewSet)


app_name = "api"
urlpatterns = router.urls
