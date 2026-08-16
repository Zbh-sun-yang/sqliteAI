#!/usr/bin/env bash
# =============================================================================
# Smart Export Workflow — One-Click NL → SQL → Export
# =============================================================================
# Usage:
#   bash export_workflow.sh <database_name> "<natural language prompt>" [csv|json]
#
# Examples:
#   bash export_workflow.sh mydb "show me all users with their orders" csv
#   bash export_workflow.sh mydb "top 10 products by revenue" json
# =============================================================================

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
DB_NAME="${1:?Usage: $0 <database_name> \"<prompt>\" [format]}"
PROMPT="${2:?Usage: $0 <database_name> \"<prompt>\" [format]}"
FMT="${3:-csv}"

echo "============================================"
echo " Smart Export Workflow"
echo "============================================"
echo " Database : $DB_NAME"
echo " Prompt   : $PROMPT"
echo " Format   : $FMT"
echo "============================================"

OUTDIR="exports"
mkdir -p "$OUTDIR"

# Step 1: Generate SQL, execute query, and download the exported file
echo ""
echo "[1/1] Generating SQL, executing query, and exporting..."
echo ""

HEADERS_FILE="$(mktemp)"
BODY_FILE="$OUTDIR/smart_export_$(date +%Y%m%d_%H%M%S).${FMT}"

HTTP_CODE=$(curl -s -o "$BODY_FILE" -D "$HEADERS_FILE" -w "%{http_code}" -X POST \
  "${API_BASE}/api/v1/dbs/${DB_NAME}/query/smart-export" \
  -H "Content-Type: application/json" \
  -d "$(printf '{"prompt":"%s","format":"%s"}' "$PROMPT" "$FMT")")

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  DETACHED_FILENAME=$(grep -i "content-disposition" "$HEADERS_FILE" | sed 's/.*filename="\(.*\)".*/\1/')

  if [ -n "$DETACHED_FILENAME" ]; then
    mv "$BODY_FILE" "$OUTDIR/$DETACHED_FILENAME"
    FINAL_FILE="$OUTDIR/$DETACHED_FILENAME"
  else
    FINAL_FILE="$BODY_FILE"
  fi

  echo "✅ Export completed successfully!"
  echo "   File: $FINAL_FILE"
  echo "   Format: ${FMT}"
  echo "   Size: $(wc -c < "$FINAL_FILE" | tr -d ' ') bytes"
else
  echo "❌ Export failed (HTTP ${HTTP_CODE})"
  cat "$BODY_FILE" 2>/dev/null || true
  rm -f "$BODY_FILE"
  rm -f "$HEADERS_FILE"
  exit 1
fi

rm -f "$HEADERS_FILE"