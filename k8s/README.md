# Spotivore Kubernetes (k3s) Deployment

This directory contains complete Kubernetes manifests to deploy Spotivore to a running k3s cluster.

## Architecture

- **`Namespace`** (`spotivore`): Isolates all Spotivore resources.
- **`PostgreSQL`** (`Deployment` + `Service`): Backed by a PersistentVolumeClaim (`postgres-data`) using k3s `local-path` storage class.
- **`Redis`** (`Deployment` + `Service`): Redis 7 for caching and session storage.
- **`Django Backend`** (`Deployment` + `Service`): ASGI application served by Gunicorn + Uvicorn worker. Runs database migrations and collects static files on startup.
- **`Frontend / Nginx`** (`Deployment` + `Service`): Multi-stage container hosting the compiled Vue 3 SPA and reverse-proxying API, auth, Spotify callback, and Django admin traffic to the Django service.
- **`Ingress`** (`Ingress`): Routes traffic via k3s's built-in Traefik ingress controller to the frontend service.
- **`Cloudflare Tunnel`** (`Deployment`): Optional tunnel container to connect your domain to Cloudflare without opening public router ports.

## Manifest Layout

- `00-namespace.yaml` — `spotivore` namespace
- `01-configmap.yaml` — Non-sensitive environment variables
- `02-secret.example.yaml` — Secret template
- `02-secret.yaml` — Secret file (gitignored, populated from `.envs/.production/`)
- `03-pvc.yaml` — PVCs for Postgres data and Django media
- `04-postgres.yaml` — Postgres Deployment and ClusterIP Service
- `05-redis.yaml` — Redis Deployment and ClusterIP Service
- `06-django.yaml` — Django backend Deployment and ClusterIP Service
- `07-frontend.yaml` — Vue 3 + Nginx frontend Deployment and ClusterIP Service
- `08-ingress.yaml` — Traefik Ingress routing for `spotivore.howington.org`
- `09-cloudflared.yaml` — Cloudflare Tunnel deployment
- `kustomization.yaml` — Kustomize configuration bundling all resources
- `deploy.sh` — Deployment script

## Quick Start

### 1. Grant your user permission to access k3s
k3s stores its kubeconfig in `/etc/rancher/k3s/k3s.yaml` with root-only permissions (`0600`). Run this once in your terminal:
```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown -R $USER:$USER ~/.kube
chmod 600 ~/.kube/config
```

### 2. Deploy
Run the deploy script:
```bash
./k8s/deploy.sh
```

Or deploy manually with `kubectl`:
```bash
# 1. Import local Docker images into k3s containerd
docker save spotivore_production_django:latest \
            spotivore_production_nginx:latest \
            spotivore_production_postgres:latest \
            redis:7-alpine \
            cloudflare/cloudflared:2026.3.0 | sudo k3s ctr images import -

# 2. Apply all manifests
kubectl apply -k k8s/

# 3. Check status
kubectl get pods,svc,ingress -n spotivore
```
