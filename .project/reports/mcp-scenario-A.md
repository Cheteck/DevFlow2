# MCP Report - 2026-10-24 20:05:22

## Requests sent

  {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"portfolio_vendable_propose","arguments":{"reference":"REF-DEMO-001","name":"Produit Test","description":"Un produit de demonstration"}}}
  {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"commerce_offer_create","arguments":{"sellerId":"seller-001","vendableId":"vendable-001","title":"Offre Test","priceInCents":1999}}}
  {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"commerce_offer_list","arguments":{"limit":5}}}
  {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"commerce_check_stock","arguments":{"productId":"prod-test"}}}

## Server responses (raw, one JSON-RPC line each)



> @mosaix/mcp@0.1.0 stdio D:\T├®l├®chargements\devflow\packages\mcp
> tsx src/stdio-server.ts

{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\n  \"id\": \"vend_3c2623ce-0170-41fd-9ca6-bafcc7931451\",\n  \"reference\": \"REF-DEMO-001\",\n  \"type\": \"Product\",\n  \"status\": \"Draft\",\n  \"name\": \"Produit Test\"\n}"}]}}
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"{\n  \"id\": \"off-eaa605c5-7166-4123-8467-0d328c5ecc39\",\n  \"title\": \"Offre Test\",\n  \"priceInCents\": 1999,\n  \"currency\": \"DZD\",\n  \"status\": \"ACTIVE\",\n  \"sellerType\": \"space\",\n  \"sellerId\": \"seller-001\",\n  \"vendableId\": \"vendable-001\"\n}"}]}}
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\n  \"results\": [\n    {\n      \"id\": \"off-eaa605c5-7166-4123-8467-0d328c5ecc39\",\n      \"title\": \"Offre Test\",\n      \"priceInCents\": 1999,\n      \"currency\": \"DZD\",\n      \"status\": \"ACTIVE\",\n      \"sellerType\": \"space\",\n      \"sellerId\": \"seller-001\",\n      \"vendableId\": \"vendable-001\"\n    }\n  ],\n  \"count\": 1\n}"}]}}
{"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"{\n  \"productId\": \"prod-test\",\n  \"inStock\": true,\n  \"availableQuantity\": 42,\n  \"warehouse\": \"EU-CENTRAL-1\"\n}"}]}}

