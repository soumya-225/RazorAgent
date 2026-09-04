#!/usr/bin/env bash
# Simple helper script to run a full SBMD checkout test flow against a local server.
# Usage: chmod +x scripts/test-sbmd.sh && ./scripts/test-sbmd.sh

set -euo pipefail
BASE_URL=${BASE_URL:-http://localhost:5000}
EMAIL=sbmd-merchant@example.com
PASSWORD=password123

echo "1) Register merchant"
REG=$(curl -s -X POST "$BASE_URL/api/auth/register" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"SBMD Merchant\",\"storeName\":\"SBMD Test Store\"}")
TOKEN=$(echo "$REG" | jq -r .token)
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Register failed: $REG" >&2
  exit 1
fi
echo "Merchant registered, token available."

AUTH_HEADER="Authorization: Bearer $TOKEN"

echo "2) Create product"
PR=$(curl -s -X POST "$BASE_URL/api/products" -H "Content-Type: application/json" -H "$AUTH_HEADER" -d '{"sku":"SBMD-1001","name":"SBMD Test Widget","description":"Demo item for SBMD test","priceInr":99.00,"costInr":50.00,"category":"Electronics>Demo","inventory":10}')
echo "Product response: $PR"

echo "3) Checkout (trigger SBMD auto-capture)"
CHK=$(curl -s -X POST "$BASE_URL/api/agents/checkout" -H "Content-Type: application/json" -H "$AUTH_HEADER" -d '{"items":[{"sku":"SBMD-1001","qty":1}],"customer":{"name":"Demo Buyer","email":"buyer@example.com","phone":"+919900112233"},"couponCode":null}')

echo "Checkout response: $CHK"

# Print useful fields
echo
echo "--- Summary ---"
echo "$CHK" | jq '{orderId:.orderId, orderNumber:.orderNumber, status:.status, paidWith:.paidWith, payment:.payment}'

echo "\nIf checkout returned status CREATED, check server logs and DB (auditLog) for why SBMD path didn't trigger. Ensure SBMD_ENABLED=true and merchant has spendingCapPaise >= order amount."
