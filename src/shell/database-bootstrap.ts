import { SQLiteDatabaseAdapter } from "@mosaix/adapter-database-sqlite";
import { SQLiteIdentityStoreAdapter } from "@mosaix/adapter-identity-store-sqlite";
import * as path from "node:path";
import * as fs from "node:fs";

export interface DatabaseBootstrapResult {
  dbAdapter: SQLiteDatabaseAdapter;
  identityStore: SQLiteIdentityStoreAdapter;
}

let cachedBootstrap: DatabaseBootstrapResult | null = null;

/**
 * Initializes and bootstraps all SQLite schemas, migrations, indices, and baseline operational seeds.
 */
export function initDatabase(): DatabaseBootstrapResult {
  if (cachedBootstrap) {
    return cachedBootstrap;
  }

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "mosaix.sqlite");
  const dbAdapter = new SQLiteDatabaseAdapter(dbPath);
  const identityStore = new SQLiteIdentityStoreAdapter(dbAdapter);

  // 1. High-Performance PRAGMA optimizations for SQLite
  dbAdapter.execute(`PRAGMA journal_mode = WAL;`).catch(() => {});
  dbAdapter.execute(`PRAGMA synchronous = NORMAL;`).catch(() => {});
  dbAdapter.execute(`PRAGMA busy_timeout = 5000;`).catch(() => {});
  dbAdapter.execute(`PRAGMA foreign_keys = ON;`).catch(() => {});

  // 2. Schema Provisioning & Safe Incremental Migrations
  const initSchemaPromise = (async () => {
    try {
      // Core Authentication & Identities Tables
      await dbAdapter.execute(`
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
      `);

      // Social & Community Feed Tables
      await dbAdapter.execute(`
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
      `);

      // Commerce & Marketplace Tables
      await dbAdapter.execute(`
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
      `);

      // Portfolio & Creative Showcase Tables
      await dbAdapter.execute(`
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
      `);

      // Spaces & Team Workspaces Tables
      await dbAdapter.execute(`
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
      `);

      // Beam / Messenger Tables
      await dbAdapter.execute(`
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
      `);

      // Booking / Appointments Tables
      await dbAdapter.execute(`
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
      `);

      // Imperia / Governance Tables
      await dbAdapter.execute(`
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
      `);

      // Solidarity / Mutual Aid Campaigns Tables
      await dbAdapter.execute(`
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
      `);

      // Platform Settings Key-Value Store
      await dbAdapter.execute(`
        CREATE TABLE IF NOT EXISTS platform_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Performance & Query Acceleration Indices
      await dbAdapter.execute(`
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
      `);

      // 3. Baseline Seeding if tables are empty
      await seedOperationalDefaults(dbAdapter);

    } catch (err) {
      console.error("[database-bootstrap] Schema init or migration error:", err);
    }
  })();

  cachedBootstrap = { dbAdapter, identityStore };
  return cachedBootstrap;
}

/**
 * Seeds high-quality operational default records if tables are fresh.
 */
async function seedOperationalDefaults(db: SQLiteDatabaseAdapter): Promise<void> {
  // 1. Seed Initial Feed Posts
  const feedCount = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM shell_feed`).catch(() => [{ count: 1 }]);
  if (feedCount[0]?.count === 0) {
    const now = Date.now();
    await db.execute(`
      INSERT INTO shell_feed (id, type, author, title, content, category, tags, likes, timestamp) VALUES
      ('feed_init_1', 'post', 'Alexandre • Architecte Produit', 'Bienvenue sur la plateforme MosaiX !', 'Ravi de vous accueillir sur notre espace de travail unifié. Les modules Portfolio, Boutique, Agenda et Messagerie sont dès à présent synchronisés.', 'announcement', '["bienvenue", "mosaix", "collaboratif"]', 14, ?),
      ('feed_init_2', 'post', 'Éléonore • Design Lead', 'Nouveau kit d''icônes et thèmes graphiques disponibles', 'Nous venons de mettre à jour la bibliothèque de styles. Vous pouvez basculer entre le mode Sombre et le mode Clair instantanément depuis la barre d''actions.', 'design', '["design-system", "theme", "ui"]', 9, ?),
      ('feed_init_3', 'post', 'Julien • Trésorier Solidaire', 'Lancement de la campagne d''entraide Q4', 'Rejoignez le projet de dotation en matériel informatique pour nos nouveaux ateliers collaboratifs !', 'solidarity', '["entraide", "projets"]', 22, ?)
    `, [now - 3600000 * 2, now - 3600000, now - 1800000]);
  }

  // 2. Seed Commerce Products
  const prodCount = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM commerce_products`).catch(() => [{ count: 1 }]);
  if (prodCount[0]?.count === 0) {
    const now = new Date().toISOString();
    await db.execute(`
      INSERT INTO commerce_products (id, title, description, price, currency, category, stock, image_url, status, created_at) VALUES
      ('prod_1', 'Pack Composants UI Pro', 'Ensemble complet de cartes, menus et graphiques réactifs pour vos applications.', 49.00, 'EUR', 'digital', 250, '🎨', 'active', ?),
      ('prod_2', 'Licence Développeur MosaiX', 'Accès prioritaire aux APIs étendues et au support de déploiement cloud.', 99.00, 'EUR', 'license', 1000, '⚡', 'active', ?),
      ('prod_3', 'Atelier Conseil Architecture (2h)', 'Session personnalisée d''audit et de cadrage technique pour vos équipes.', 180.00, 'EUR', 'service', 15, '📅', 'active', ?),
      ('prod_4', 'Guide des Bonnes Pratiques Web', 'Manuel exhaustif sur l''accessibilité, la performance et la sécurité web.', 29.00, 'EUR', 'book', 500, '📚', 'active', ?)
    `, [now, now, now, now]);
  }

  // 3. Seed Portfolio Items
  const portCount = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM portfolio_items`).catch(() => [{ count: 1 }]);
  if (portCount[0]?.count === 0) {
    const now = new Date().toISOString();
    await db.execute(`
      INSERT INTO portfolio_items (id, title, description, creator_id, image_url, category, tags, price, status, created_at) VALUES
      ('port_1', 'Tableau de bord Minimaliste', 'Interface ergonomique avec visualisations de flux en temps réel.', 'designer', '✨', 'ui', '["dashboard", "clean"]', 35.0, 'published', ?),
      ('port_2', 'Identité Visuelle & Logo MosaiX', 'Charte graphique complète incluant typographies et palettes contrastées.', 'designer', '🌌', 'branding', '["branding", "vector"]', 75.0, 'published', ?),
      ('port_3', 'Architecture Modulaire Hexagonale', 'Schéma d''architecture logicielle et patrons de conception découplés.', 'admin', '🏛️', 'architecture', '["tech", "specs"]', 0.0, 'published', ?)
    `, [now, now, now]);
  }

  // 4. Seed Spaces
  const spaceCount = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM spaces`).catch(() => [{ count: 1 }]);
  if (spaceCount[0]?.count === 0) {
    const now = new Date().toISOString();
    await db.execute(`
      INSERT INTO spaces (id, name, description, owner_role, badge, avatar, members_count, is_private, created_at) VALUES
      ('space-design', 'Design System Lab', 'Conception des composants visuels, maquettes et guides d''ergonomie.', 'designer', '🎨', '🎨', 8, 0, ?),
      ('space-dev', 'Développeurs & Intégration', 'Coordination technique, revue de code et déploiements continus.', 'admin', '💻', '💻', 15, 0, ?),
      ('space-gov', 'Gouvernance & Décisions', 'Espace de délibération citoyenne et suivi des votes de la plateforme.', 'auditor', '🏛️', '🏛️', 24, 0, ?)
    `, [now, now, now]);
  }

  // 5. Seed Beam Channels & Initial Messages
  const beamCount = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM beam_channels`).catch(() => [{ count: 1 }]);
  if (beamCount[0]?.count === 0) {
    const nowIso = new Date().toISOString();
    const nowTs = Date.now();
    await db.execute(`
      INSERT INTO beam_channels (id, name, description, icon, is_private, created_at) VALUES
      ('chan_general', 'Général', 'Salon d''échange ouvert à tous les membres.', '💬', 0, ?),
      ('chan_annonces', 'Annonces & Mises à jour', 'Informations officielles de la plateforme.', '📢', 0, ?),
      ('chan_entraide', 'Entraide & Questions', 'Partage d''astuces et support entre collègues.', '🤝', 0, ?)
    `, [nowIso, nowIso, nowIso]);

    await db.execute(`
      INSERT INTO beam_messages (id, channel_id, sender_id, sender_name, sender_avatar, content, timestamp) VALUES
      ('msg_1', 'chan_general', 'admin', 'Alexandre • Administrateur', '👤', 'Bienvenue sur la messagerie Beam ! Vous pouvez échanger ici en temps réel.', ?),
      ('msg_2', 'chan_general', 'designer', 'Éléonore • Designer', '🎨', 'Super, l''interface est très fluide et agréable.', ?)
    `, [nowTs - 600000, nowTs - 300000]);
  }

  // 6. Seed Booking Slots
  const bookCount = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM booking_slots`).catch(() => [{ count: 1 }]);
  if (bookCount[0]?.count === 0) {
    await db.execute(`
      INSERT INTO booking_slots (id, title, host_id, start_time, end_time, capacity, booked_count, status) VALUES
      ('slot_1', 'Session Découverte Plateforme', 'admin', '2026-09-28 10:00', '2026-09-28 11:00', 5, 2, 'available'),
      ('slot_2', 'Revue de Design & Expérience Utilisateur', 'designer', '2026-09-28 14:30', '2026-09-28 15:30', 3, 1, 'available'),
      ('slot_3', 'Audit Sécurité & Droits d''accès', 'auditor', '2026-09-29 16:00', '2026-09-29 17:00', 2, 0, 'available')
    `);
  }

  // 7. Seed Imperia Proposals
  const impCount = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM imperia_proposals`).catch(() => [{ count: 1 }]);
  if (impCount[0]?.count === 0) {
    const now = new Date().toISOString();
    await db.execute(`
      INSERT INTO imperia_proposals (id, title, summary, author, status, category, votes_for, votes_against, votes_abstain, ends_at, created_at) VALUES
      ('prop_1', 'Intégration d''un mode hors-ligne pour l''agenda', 'Permettre la consultation des rendez-vous et tâches sans connexion active.', 'Éléonore', 'active', 'technique', 28, 2, 4, '2026-10-15', ?),
      ('prop_2', 'Ouverture d''un fonds de soutien aux créations numériques', 'Allouer 5% des bénéfices de la boutique aux projets créatifs émergents.', 'Julien', 'active', 'solidarité', 45, 3, 1, '2026-10-20', ?)
    `, [now, now]);
  }

  // 8. Seed Solidarity Campaigns
  const solCount = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM solidarity_campaigns`).catch(() => [{ count: 1 }]);
  if (solCount[0]?.count === 0) {
    const now = new Date().toISOString();
    await db.execute(`
      INSERT INTO solidarity_campaigns (id, title, description, goal_amount, raised_amount, currency, beneficiary, status, created_at) VALUES
      ('camp_1', 'Équipement numérique pour les ateliers locaux', 'Financement de 10 postes de travail reconditionnés pour les espaces communautaires.', 2500.0, 1850.0, 'EUR', 'Association Numérique Pour Tous', 'active', ?),
      ('camp_2', 'Soutien aux projets créatifs indépendants', 'Bourses de création pour artistes et développeurs open source.', 1500.0, 920.0, 'EUR', 'Collectif OpenArt', 'active', ?)
    `, [now, now]);
  }
}
