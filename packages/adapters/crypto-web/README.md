# @mosaix/adapter-crypto-web

Web Crypto API adapter implementing [`CryptoPort`](../../ports/crypto), based on `SubtleCrypto`.

## Constructor

```typescript
new WebCryptoAdapter(customCrypto?: CryptoLike);
```

- **nothing** — uses global `crypto` when available, otherwise `node:crypto.webcrypto`.
- **customCrypto** — accepts any object with the required `SubtleCrypto`-style members (`getRandomValues` and a `subtle`), so an injected mock or a Node `webcrypto` instance can be supplied without `any`.

## Features

- **hash** — defaults to `sha-256`; the string `"sha256"` is normalized to `"SHA-256"`.
- **encrypt/decrypt** — AES-GCM with a 12-byte random IV. **Note:** unlike `crypto-node`, the authentication tag is **appended to the ciphertext** by Web Crypto — `tag` is not returned, and `decrypt` does not accept one.
- **sign/verify** — RSASSA-PKCS1-v1_5 with SHA-256, importing PEM keys (PKCS#8 private, SPKI public).
- **randomBytes** — `getRandomValues`-based.

## Interop caveat

Because of the different tag handling, ciphertext produced by `crypto-node` is not directly decryptable by `crypto-web` (and vice-versa). See `.project/backlog/ports-adapters-foundation.md` (task T-I3).

## Usage

```typescript
import { WebCryptoAdapter } from "@mosaix/adapter-crypto-web";

const crypto = new WebCryptoAdapter();
const hash = await crypto.hash("data");

const key = crypto.randomBytes(32);
const { ciphertext, iv } = await crypto.encrypt("secret", key);
const plain = await crypto.decrypt(ciphertext, key, iv).toString("utf-8");
```

## Related

- Port: [`@mosaix/ports-crypto`](../../ports/crypto)
