#!/usr/bin/env bash
# Phase 1 — Audit & Cartographie MCP
# Exécute les appels JSON-RPC de base pour cartographier la plateforme

set -e

echo "=== Phase 1: Audit MCP ==="
echo "Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Fonction pour envoyer une requête JSON-RPC au serveur MCP (stdio)
mcp_call() {
  local method="$1"
  local params="$2"
  local id="$3"
  
  echo "{\"jsonrpc\":\"2.0\",\"id\":${id},\"method\":\"${method}\",\"params\":${params}}"
}

# Créer un fichier de requêtes
REQUESTS_FILE=$(mktemp)
cat > "$REQUESTS_FILE" << 'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"resources/list","params":{}}
{"jsonrpc":"2.0","id":4,"method":"prompts/list","params":{}}
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"platform_get_topology","arguments":{}}}
EOF

echo "Requêtes JSON-RPC préparées:"
cat "$REQUESTS_FILE"
echo ""

# Exécuter le serveur MCP en stdio et envoyer les requêtes
echo "Exécution du serveur MCP..."
echo "========================================"

# Démarrer le serveur MCP et envoyer les requêtes
(
  cat "$REQUESTS_FILE"
  echo '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}'
) | pnpm --filter @mosaix/mcp exec tsx ../../packages/mcp/src/stdio-server.ts

# Nettoyer
rm -f "$REQUESTS_FILE"

echo ""
echo "=== Audit terminé ==="
echo "Prochaine étape: analyser les résultats dans .project/reports/mcp-audit-week1.md"