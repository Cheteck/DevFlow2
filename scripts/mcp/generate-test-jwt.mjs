// Generate a JWT for MCP testing with mcp:admin scope
// Usage: node generate-test-jwt.mjs > token.txt
// Reads MOSAIX_AUTH_JWT_SECRET from environment

import crypto from 'crypto';

const secret = process.env.MOSAIX_AUTH_JWT_SECRET;
if (!secret) {
  console.error('MOSAIX_AUTH_JWT_SECRET env var is required');
  process.exit(1);
}

const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  sub: 'agent-dev-mcp',
  tenantId: 'default-tenant',
  scopes: ['mcp:admin', 'mcp:read'],
  permissions: ['mcp:admin'],
  roles: ['admin'],
  exp: Math.floor(Date.now() / 1000) + 3600
})).toString('base64url');

const signingInput = `${header}.${payload}`;
const signature = crypto
  .createHmac('sha256', secret)
  .update(signingInput)
  .digest('base64url');

console.log(`${signingInput}.${signature}`);
