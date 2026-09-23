# MosaiX Infrastructure Flexibility: Ports & Adapters Architecture Proof

This document provides architectural proof of how MosaiX decouples core application logic from underlying infrastructure technologies (such as Caching, File Storage, Databases, Messaging, Emails, SMS, Cryptography, Search, and Feature Flags), allowing seamless runtime swaps.

---

## 1. Concrete Proof of Decoupling

In MosaiX, applications (Bounded Application Contexts) and high-level developer libraries never reference concrete third-party SDKs (such as `ioredis`, `@aws-sdk/client-s3`, `kafkajs`, `amqplib`, `nodemailer`, or `launchdarkly-node-server-sdk`). Instead, they consume abstract interfaces called **Ports**.

The mapping flow strictly adheres to the dependency boundary rules:
```text
Application Logic ➔ High-level Developer API ➔ Port Contract (Abstractions)
                                                       ▲
                                                       │
                                            Concrete Adapters (Implementations)
```

Because of this inversion of control, we can completely swap the underlying infrastructure adapter during application startup (in the bootstrap Service Provider or Kernel configuration) without modifying a single line of business or developer code.

---

## 2. Caching Infrastructure (In-Memory vs. Redis)

* **Port Contract (`CachePort`)**: `get<T>`, `set<T>`, `delete`, `clear`.
* **Swapping implementation**:

```typescript
import { Container } from "@mosaix/container";
import { MemoryCacheAdapter } from "@mosaix/adapter-cache-memory";
import { RedisCacheAdapter } from "@mosaix/adapter-cache-redis";
import { Cache } from "@mosaix/cache";

const container = new Container();

if (process.env.NODE_ENV === "development") {
  container.singleton("CachePort", () => new MemoryCacheAdapter());
} else {
  container.singleton("CachePort", () => new RedisCacheAdapter({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT)
  }));
}

container.singleton("cache", (c) => new Cache(c.make("CachePort")));
```

---

## 3. Filesystem Storage Infrastructure (Local Disk vs. AWS S3)

* **Port Contract (`StoragePort`)**: `write`, `read`, `readString`, `delete`, `exists`.
* **Swapping implementation**:

```typescript
import { Container } from "@mosaix/container";
import { LocalStorageAdapter } from "@mosaix/adapter-storage-local";
import { S3StorageAdapter } from "@mosaix/adapter-storage-s3";
import { Filesystem } from "@mosaix/filesystem";

const container = new Container();

const defaultStorageDisk = process.env.STORAGE_DRIVER === "s3"
  ? new S3StorageAdapter("mosaix-assets-bucket")
  : new LocalStorageAdapter("/var/data/mosaix");

container.singleton("filesystem", () => new Filesystem(defaultStorageDisk));
```

---

## 4. Database Infrastructure (SQLite vs. PostgreSQL)

* **Port Contract (`DatabasePort`)**: Aligned with ADR-0006, provides schema-execution connection handles, query runners, and distributed migration locking.
* **Swapping implementation**:

```typescript
import { Container } from "@mosaix/container";
import { NodeSQLiteDriver, SqliteDatabaseAdapter } from "@mosaix/adapter-database-sqlite";
import { PgClient, PostgresDatabaseAdapter } from "@mosaix/adapter-database-postgres";

const container = new Container();

if (process.env.DB_DIALECT === "postgres") {
  container.singleton("DatabasePort", () => new PostgresDatabaseAdapter(
    new PgClient({ connectionString: process.env.DATABASE_URL })
  ));
} else {
  container.singleton("DatabasePort", () => new SqliteDatabaseAdapter(
    new NodeSQLiteDriver(":memory:")
  ));
}
```

---

## 5. Email Dispatching (SMTP vs. AWS SES)

* **Port Contract (`EmailPort`)**: `send(message: EmailMessage): Promise<EmailResult>`.
* **Swapping implementation**:

```typescript
import { Container } from "@mosaix/container";
import { SmtpEmailAdapter } from "@mosaix/adapter-email-smtp";
import { SesEmailAdapter } from "@mosaix/adapter-email-ses";

const container = new Container();

if (process.env.EMAIL_DRIVER === "ses") {
  container.singleton("EmailPort", () => new SesEmailAdapter("eu-west-1"));
} else {
  container.singleton("EmailPort", () => new SmtpEmailAdapter({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT)
  }));
}
```

---

## 6. Messaging Infrastructure (In-Memory vs. Kafka vs. RabbitMQ)

* **Port Contract (`MessageBusPort`)**: Decouples event publishing and subscription routines.
* **Swapping implementation**:

```typescript
import { Container } from "@mosaix/container";
import { MosaixMessageBusAdapter } from "@mosaix/adapter-messagebus-mosaix";
import { KafkaMessageBusAdapter } from "@mosaix/adapter-kafka";
import { RabbitMQMessageBusAdapter } from "@mosaix/adapter-rabbitmq";

const container = new Container();

if (process.env.MSG_BROKER === "kafka") {
  container.singleton("MessageBus", () => new KafkaMessageBusAdapter({ brokers: ["localhost:9092"] }));
} else if (process.env.MSG_BROKER === "rabbitmq") {
  container.singleton("MessageBus", () => new RabbitMQMessageBusAdapter("amqp://localhost"));
} else {
  container.singleton("MessageBus", () => new MosaixMessageBusAdapter());
}
```

---

## 7. Cryptography Engines (Native NodeCrypto vs. WebCrypto API)

* **Port Contract (`CryptoPort`)**: `encrypt`, `decrypt`, `hash`, `sign`, `verify`.
* **Swapping implementation**:
  - `NodeCryptoAdapter`: S'appuie sur le module natif `node:crypto`.
  - `WebCryptoAdapter`: S'appuie sur l'API standard `crypto.subtle` pour s'exécuter dans des environnements sandboxés de type Web Workers (Edge computing).

```typescript
import { Container } from "@mosaix/container";
import { NodeCryptoAdapter } from "@mosaix/adapter-crypto-node";
import { WebCryptoAdapter } from "@mosaix/adapter-crypto-web";

const container = new Container();

// En fonction du runtime d'exécution (Node vs. Cloudflare Workers / Browser)
if (typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined") {
  container.singleton("CryptoPort", () => new WebCryptoAdapter());
} else {
  container.singleton("CryptoPort", () => new NodeCryptoAdapter());
}
```

---

## 8. Feature Flag Management (Memory vs. LaunchDarkly)

* **Port Contract (`FeatureFlagsPort`)**: `isEnabled`, `getVariation`.
* **Swapping implementation**:

```typescript
import { Container } from "@mosaix/container";
import { MemoryFeatureFlagsAdapter } from "@mosaix/adapter-featureflags-memory";
import { LaunchDarklyFeatureFlagsAdapter } from "@mosaix/adapter-featureflags-launchdarkly";

const container = new Container();

if (process.env.LAUNCHDARKLY_SDK_KEY) {
  container.singleton("FeatureFlagsPort", () => new LaunchDarklyFeatureFlagsAdapter(
    process.env.LAUNCHDARKLY_SDK_KEY
  ));
} else {
  container.singleton("FeatureFlagsPort", () => new MemoryFeatureFlagsAdapter({
    "new-ui-enabled": true
  }));
}
```

---

## 9. Search Indexation (In-Memory vs. Elasticsearch)

* **Port Contract (`SearchPort`)**: `index`, `search`, `delete`.
* **Swapping implementation**:

```typescript
import { Container } from "@mosaix/container";
import { MemorySearchAdapter } from "@mosaix/adapter-search-memory";
import { ElasticsearchSearchAdapter } from "@mosaix/adapter-search-elasticsearch";

const container = new Container();

if (process.env.NODE_ENV === "production") {
  container.singleton("SearchPort", () => new ElasticsearchSearchAdapter({
    node: "http://localhost:9200"
  }));
} else {
  container.singleton("SearchPort", () => new MemorySearchAdapter());
}
```

---

## 10. Conclusion on Absolute Flexibility

La stricte conformité à l'architecture Ports & Adapters au sein de MosaiX élimine complètement l'adhérence technologique. L'ensemble des 24 adaptateurs et 16 ports implémentés permet de configurer le framework à la volée, garantissant :
1. Une transition transparente du local vers le cloud.
2. Une testabilité unitaire parfaite via des mocks in-memory ultra-rapides.
3. Une résilience d'exécution absolue face au changement technologique.
