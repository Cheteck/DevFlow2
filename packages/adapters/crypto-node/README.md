# @mosaix/adapter-crypto-node

Node.js cryptographic adapter implementing [`CryptoPort`](../../ports/crypto), built on `node:crypto`.

## Features

- **hash** — defaults to `sha256`, returns a hex digest. Any `createHash` algorithm is supported.
- **encrypt/decrypt** — AES-256-GCM with a 12-byte random IV. The authentication tag is returned separately in `tag`; pass it back to `decrypt`.
- **sign/verify** — RSA with SHA-256, using PEM keys.
- **randomBytes** — CSPRNG via `node:crypto.randomBytes`.

## Usage

```typescript
import { NodeCryptoAdapter } from "@mosaix/adapter-crypto-node";

const crypto = new NodeCryptoAdapter();
const hash = await crypto.hash("data"); // sha256 hex

const key = crypto.randomBytes(32);
const { ciphertext, iv, tag } = await crypto.encrypt("secret", key);
const plain = await crypto.decrypt(ciphertext, key, iv, tag).toString("utf-8");
```

## Related

- Port: [`@mosaix/ports-crypto`](../../ports/crypto)
