#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
#  Push OpenCode Evolved → GitHub
#  Uso: bash bin/push-to-github.sh
#  O con variables:
#    GITHUB_USER=miusuario GITHUB_REPO=mi-repo bash bin/push-to-github.sh
# ════════════════════════════════════════════════════════════
set -e

# ── Configuración (edita estos valores o pásalos como env vars) ──
GITHUB_USER="${GITHUB_USER:-daveymena}"
GITHUB_REPO="${GITHUB_REPO:-epncode-evolution}"
BRANCH="${BRANCH:-main}"

REPO_URL="https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git"

# ── Verificar token ──────────────────────────────────────────
TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN:-$GITHUB_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌  Falta el token de GitHub"
  echo "    Configura GITHUB_PERSONAL_ACCESS_TOKEN o GITHUB_TOKEN"
  echo "    Crea uno en: https://github.com/settings/tokens"
  exit 1
fi

echo "🔧  Configurando remote 'github'..."
git remote remove github 2>/dev/null || true
git remote add github "https://${GITHUB_USER}:${TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git"

echo "📋  Commits a subir:"
git log --oneline -5

echo ""
echo "🚀  Haciendo push a ${REPO_URL}..."
git push github HEAD:"${BRANCH}" --force 2>&1 | grep -v "$TOKEN" || true

echo ""
echo "✅  ¡Push exitoso!"
echo "    Repo: ${REPO_URL}"
echo ""
echo "📌  Próximo paso en EasyPanel:"
echo "    1. New Project → Add Service → App"
echo "    2. Source: GitHub → ${GITHUB_USER}/${GITHUB_REPO}"
echo "    3. Branch: ${BRANCH}"
echo "    4. EasyPanel detectará el Dockerfile automáticamente"
echo "    5. Agrega tus API keys en Environment Variables"
echo "    6. Deploy!"

git remote remove github 2>/dev/null || true
