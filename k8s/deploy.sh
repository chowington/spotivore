#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$DIR")"

echo "=== Spotivore k3s Deployment ==="

# 1. Check Kubeconfig / cluster access
if ! kubectl get nodes >/dev/null 2>&1; then
    echo "[-] Cannot access k3s cluster with current user permissions."
    echo "    k3s stores its kubeconfig in /etc/rancher/k3s/k3s.yaml with root permissions."
    echo "    Please run the following one-time setup command in your terminal:"
    echo ""
    echo "      mkdir -p ~/.kube && sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && sudo chown -R \$USER:\$USER ~/.kube && chmod 600 ~/.kube/config"
    echo ""
    exit 1
fi

echo "[+] k3s cluster connection verified."

# 2. Ensure images are imported into k3s containerd
echo "[*] Importing Docker images into k3s containerd..."
echo "    Images: spotivore_production_django:latest, spotivore_production_nginx:latest, spotivore_production_postgres:latest"
if command -v docker >/dev/null 2>&1; then
    # Pull redis if not present
    docker pull redis:7-alpine >/dev/null 2>&1 || true

    echo "    (If prompted for sudo password, it is to import images into /run/k3s/containerd/containerd.sock)"
    docker save spotivore_production_django:latest \
                spotivore_production_nginx:latest \
                spotivore_production_postgres:latest \
                redis:7-alpine \
                cloudflare/cloudflared:2026.3.0 2>/dev/null | sudo k3s ctr images import -
    echo "[+] Images imported into k3s containerd."
else
    echo "[!] Docker command not found. Ensure images are available in k3s."
fi

# 3. Apply manifests via kustomize
echo "[*] Applying Kubernetes manifests..."
kubectl apply -k "$DIR"

echo "[*] Waiting for deployments to roll out..."
kubectl rollout status deployment/postgres -n spotivore --timeout=120s
kubectl rollout status deployment/redis -n spotivore --timeout=60s
kubectl rollout status deployment/django -n spotivore --timeout=180s
kubectl rollout status deployment/frontend -n spotivore --timeout=60s
kubectl rollout status deployment/cloudflared -n spotivore --timeout=60s || true

echo ""
echo "=== Deployment Complete ==="
kubectl get pods,svc,ingress -n spotivore
