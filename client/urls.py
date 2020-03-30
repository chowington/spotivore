from django.urls import path
from . import views

urlpatterns = [
    path('', views.login_view, name='login'),
    path('client/', views.client_view, name='client'),
    path('api/playlists/<str:playlist_id>/sublists', views.PlaylistSublists.as_view()),
    path('api/playlists/<str:playlist_id>/sublists/pull', views.add_tracks_from_sublists.as_view()),
    path('api/playlists/<str:playlist_id>/save', views.save_playlist_changes_to_spotify.as_view())
]
