# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spotivore is a custom Spotify client with a Django REST API backend and Vue 3 frontend.

## Commands

### Running Tests

Tests must be run via Docker:

```bash
# Run all backend tests
docker compose -f docker-compose.local.yml run --rm django pytest

# Run a single test file
docker compose -f docker-compose.local.yml run --rm django pytest spotivore/music/tests/test_models.py

# Run a single test
docker compose -f docker-compose.local.yml run --rm django pytest spotivore/music/tests/test_models.py::test_track_spotify_id_must_be_unique

# Run frontend unit tests
cd client && npm run test:unit

# Run a specific frontend test file
cd client && npm run test:unit -- src/__tests__/components/TrackItem.test.ts
```

### Linting & Formatting

```bash
# Backend (runs via pre-commit hooks, or manually)
ruff check .
ruff format .

# Frontend
cd client && npm run lint
cd client && npm run format
cd client && npm run type-check
```

### Development

```bash
# Start all local services
docker compose -f docker-compose.local.yml up

# Build the Django image
docker compose -f docker-compose.local.yml build django
```

## Architecture

### Backend (`spotivore/`, `config/`)

Django 5.0 + Django REST Framework app organized into three main apps:

- **`spotivore/users/`** — Custom User model, authentication via django-allauth with FIDO2 MFA support
- **`spotivore/spotify/`** — Spotify OAuth + API integration; services for fetching tracks/playlists from Spotify
- **`spotivore/music/`** — Core domain: `Track`, `Playlist`, `TrackInPlaylist`, `ListeningSession` models; business logic in a services layer

API routes are registered in `config/api_router.py`. Settings are split by environment under `config/settings/` (`base.py`, `local.py`, `production.py`, `test.py`).

### Frontend (`client/src/`)

Vue 3 + TypeScript + Pinia + Vue Router. The Vite dev server proxies `/api` to the Django backend. CSRF protection uses cookies.

### Infrastructure

- **Local:** Django + PostgreSQL + Node dev server (no Redis, no Nginx)
- **Production:** adds Redis (cache/sessions), Nginx (reverse proxy + static files), Cloudflare Tunnel

## Testing Notes

- Backend tests use pytest-django with `config.settings.test` (SQLite in-memory)
- Database tests require the `@pytest.mark.django_db` marker
- The `user` fixture (in `spotivore/conftest.py`) creates a test user via `UserFactory`
