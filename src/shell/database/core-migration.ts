/**
 * @shell/database — Shell core migration provider (Laravel-style `database/migrations`).
 *
 * Owns the shell-level tables (identities/auth, feed, commerce, portfolio,
 * spaces, beam, booking, imperia, solidarity, subscriptions, platform
 * settings) as versioned migrations executed **only from the CLI** (`mosaix migrate`),
 * tracked in the `mosaix_migrations` ledger — never as ad-hoc DDL at boot.
 *
 * Content is intentionally byte-faithful to the historical bootstrap schema
 * (no schema change in this move, only the execution path changes).
 * Per-BAC ownership (each app owning its tables) is the documented next step.
 */
import {
  computeChecksum,
  type Migration,
  type MigrationProvider,
} from "@mosaix/migrations";

export const SHELL_CORE_MIGRATION_ID = "shell.core.v1.001_create_core_tables";
export const SHELL_SUBSCRIPTION_MIGRATION_ID = "shell.core.v1.002_create_subscription_tables";

const UP = `
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT DEFAULT 'default',
  email TEXT UNIQUE,
  display_name TEXT,
  status TEXT DEFAULT 'active',
  password_hash TEXT,
  roles TEXT DEFAULT '["member"]',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  attributes TEXT
);

CREATE TABLE IF NOT EXISTS external_identities (
  identity_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  attributes TEXT,
  PRIMARY KEY (identity_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  data TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'default',
  application_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  attributes TEXT
);

CREATE TABLE IF NOT EXISTS tokens (
  token_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  attributes TEXT
);

CREATE TABLE IF NOT EXISTS shell_feed (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'post',
  author TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  tags TEXT,
  likes INTEGER DEFAULT 0,
  timestamp INTEGER NOT NULL,
  space_id TEXT
);

CREATE TABLE IF NOT EXISTS commerce_products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  category TEXT NOT NULL DEFAULT 'digital',
  stock INTEGER NOT NULL DEFAULT 100,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  items TEXT NOT NULL,
  total_amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending',
  shipping_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS commerce_cart_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  creator_id TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'design',
  tags TEXT,
  price REAL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_role TEXT NOT NULL,
  badge TEXT NOT NULL,
  avatar TEXT NOT NULL,
  members_count INTEGER NOT NULL DEFAULT 1,
  is_private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS space_members (
  space_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (space_id, user_id)
);

CREATE TABLE IF NOT EXISTS beam_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '💬',
  is_private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beam_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT DEFAULT '👤',
  content TEXT NOT NULL,
  attachments TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS booking_slots (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  host_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  booked_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS booking_reservations (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS imperia_proposals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  author TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  category TEXT NOT NULL DEFAULT 'governance',
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  votes_abstain INTEGER NOT NULL DEFAULT 0,
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS imperia_votes (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  choice TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  cast_at TEXT NOT NULL,
  UNIQUE(proposal_id, user_id)
);

CREATE TABLE IF NOT EXISTS solidarity_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  goal_amount REAL NOT NULL,
  raised_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  beneficiary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS solidarity_contributions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  message TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identities_email ON identities (email);
CREATE INDEX IF NOT EXISTS idx_identities_tenant ON identities (tenant_id);
CREATE INDEX IF NOT EXISTS idx_shell_feed_timestamp ON shell_feed (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_shell_feed_category ON shell_feed (category);
CREATE INDEX IF NOT EXISTS idx_commerce_products_cat ON commerce_products (category);
CREATE INDEX IF NOT EXISTS idx_portfolio_creator ON portfolio_items (creator_id);
CREATE INDEX IF NOT EXISTS idx_beam_messages_channel ON beam_messages (channel_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_booking_slots_time ON booking_slots (start_time);
CREATE INDEX IF NOT EXISTS idx_imperia_proposals_status ON imperia_proposals (status);
CREATE INDEX IF NOT EXISTS idx_solidarity_campaigns_status ON solidarity_campaigns (status);
`;

const DOWN = `
DROP TABLE IF EXISTS solidarity_contributions;
DROP TABLE IF EXISTS solidarity_campaigns;
DROP TABLE IF EXISTS imperia_votes;
DROP TABLE IF EXISTS imperia_proposals;
DROP TABLE IF EXISTS booking_reservations;
DROP TABLE IF EXISTS booking_slots;
DROP TABLE IF EXISTS beam_messages;
DROP TABLE IF EXISTS beam_channels;
DROP TABLE IF EXISTS space_members;
DROP TABLE IF EXISTS spaces;
DROP TABLE IF EXISTS portfolio_items;
DROP TABLE IF EXISTS commerce_cart_items;
DROP TABLE IF EXISTS commerce_orders;
DROP TABLE IF EXISTS commerce_products;
DROP TABLE IF EXISTS shell_feed;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS credentials;
DROP TABLE IF EXISTS external_identities;
DROP TABLE IF EXISTS identities;
DROP TABLE IF EXISTS platform_settings;
`;

const UP_SUBSCRIPTIONS = `
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT,
  status TEXT,
  current_period_start INTEGER,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER,
  metered_usage_units INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions (status);
`;

const DOWN_SUBSCRIPTIONS = `
DROP TABLE IF EXISTS user_subscriptions;
`;

export class ShellCoreMigrationProvider implements MigrationProvider {
  ownerId(): string {
    return "shell";
  }

  migrations(): readonly Migration[] {
    return [
      {
        id: SHELL_CORE_MIGRATION_ID,
        content: UP,
        down: DOWN,
        checksum: computeChecksum(UP),
        resources: [
          "table:identities",
          "table:external_identities",
          "table:credentials",
          "table:sessions",
          "table:tokens",
          "table:shell_feed",
          "table:commerce_products",
          "table:commerce_orders",
          "table:commerce_cart_items",
          "table:portfolio_items",
          "table:spaces",
          "table:space_members",
          "table:beam_channels",
          "table:beam_messages",
          "table:booking_slots",
          "table:booking_reservations",
          "table:imperia_proposals",
          "table:imperia_votes",
          "table:solidarity_campaigns",
          "table:solidarity_contributions",
          "table:platform_settings",
        ],
      },
      {
        // v1.002 — subscription persistence previously ensured ad-hoc by the
        // SubscriptionService constructor (removed per CONF-DB-001). The
        // Postgres provider (apps/subscription) owns this schema long-term;
        // this SQLite table keeps the shell runtime working until per-BAC
        // ownership lands (backlog DB-BAC-OWNERSHIP).
        id: SHELL_SUBSCRIPTION_MIGRATION_ID,
        content: UP_SUBSCRIPTIONS,
        down: DOWN_SUBSCRIPTIONS,
        checksum: computeChecksum(UP_SUBSCRIPTIONS),
        resources: ["table:user_subscriptions"],
      },
    ];
  }
}
