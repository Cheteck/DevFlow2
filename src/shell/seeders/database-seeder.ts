/**
 * @shell/seeders — DatabaseSeeder (Laravel-style `database/seeders`).
 *
 * Baseline operational seeds, executed **only from the CLI**
 * (`mosaix db:seed`, or `db:setup` = migrate + seed). Never at boot:
 * the boot path connects + verifies, it never writes demo data.
 *
 * Every block is idempotent-if-empty (`SELECT COUNT` guard) and uses
 * dialect-aware placeholders (`?` on SQLite, `$n` on Postgres) so the same
 * seeder serves every driver behind `DatabasePort`.
 */
import type { DatabasePort } from "@mosaix/ports-database";

function bind(db: DatabasePort, sql: string): string {
  if (db.capabilities.dialect !== "postgres") return sql;
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function tableCount(db: DatabasePort, table: string): Promise<number> {
  const rows = await db
    .query<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`)
    .catch(() => [{ count: 1 }]);
  return rows[0]?.count ?? 1;
}

/**
 * Run all baseline seeds. Safe to re-run: tables that already hold rows
 * are skipped.
 */
export async function runDatabaseSeeds(db: DatabasePort): Promise<string[]> {
  const seeded: string[] = [];

  // 1. Initial feed posts
  if ((await tableCount(db, "shell_feed")) === 0) {
    const now = Date.now();
    await db.execute(
      bind(
        db,
        `
      INSERT INTO shell_feed (id, type, author, title, content, category, tags, likes, timestamp) VALUES
      ('feed_init_1', 'post', 'Alexandre • Architecte Produit', 'Bienvenue sur la plateforme MosaiX !', 'Ravi de vous accueillir sur notre espace de travail unifié. Les modules Portfolio, Boutique, Agenda et Messagerie sont dès à présent synchronisés.', 'announcement', '["bienvenue", "mosaix", "collaboratif"]', 14, ?),
      ('feed_init_2', 'post', 'Éléonore • Design Lead', 'Nouveau kit d''icônes et thèmes graphiques disponibles', 'Nous venons de mettre à jour la bibliothèque de styles. Vous pouvez basculer entre le mode Sombre et le mode Clair instantanément depuis la barre d''actions.', 'design', '["design-system", "theme", "ui"]', 9, ?),
      ('feed_init_3', 'post', 'Julien • Trésorier Solidaire', 'Lancement de la campagne d''entraide Q4', 'Rejoignez le projet de dotation en matériel informatique pour nos nouveaux ateliers collaboratifs !', 'solidarity', '["entraide", "projets"]', 22, ?)
    `,
      ),
      [now - 3600000 * 2, now - 3600000, now - 1800000],
    );
    seeded.push("shell_feed");
  }

  // 2. Commerce products
  if ((await tableCount(db, "commerce_products")) === 0) {
    const now = new Date().toISOString();
    await db.execute(
      bind(
        db,
        `
      INSERT INTO commerce_products (id, title, description, price, currency, category, stock, image_url, status, created_at) VALUES
      ('prod_1', 'Pack Composants UI Pro', 'Ensemble complet de cartes, menus et graphiques réactifs pour vos applications.', 49.00, 'EUR', 'digital', 250, '🎨', 'active', ?),
      ('prod_2', 'Licence Développeur MosaiX', 'Accès prioritaire aux APIs étendues et au support de déploiement cloud.', 99.00, 'EUR', 'license', 1000, '⚡', 'active', ?),
      ('prod_3', 'Atelier Conseil Architecture (2h)', 'Session personnalisée d''audit et de cadrage technique pour vos équipes.', 180.00, 'EUR', 'service', 15, '📅', 'active', ?),
      ('prod_4', 'Guide des Bonnes Pratiques Web', 'Manuel exhaustif sur l''accessibilité, la performance et la sécurité web.', 29.00, 'EUR', 'book', 500, '📚', 'active', ?)
    `,
      ),
      [now, now, now, now],
    );
    seeded.push("commerce_products");
  }

  // 3. Portfolio items
  if ((await tableCount(db, "portfolio_items")) === 0) {
    const now = new Date().toISOString();
    await db.execute(
      bind(
        db,
        `
      INSERT INTO portfolio_items (id, title, description, creator_id, image_url, category, tags, price, status, created_at) VALUES
      ('port_1', 'Tableau de bord Minimaliste', 'Interface ergonomique avec visualisations de flux en temps réel.', 'designer', '✨', 'ui', '["dashboard", "clean"]', 35.0, 'published', ?),
      ('port_2', 'Identité Visuelle & Logo MosaiX', 'Charte graphique complète incluant typographies et palettes contrastées.', 'designer', '🌌', 'branding', '["branding", "vector"]', 75.0, 'published', ?),
      ('port_3', 'Architecture Modulaire Hexagonale', 'Schéma d''architecture logicielle et patrons de conception découplés.', 'admin', '🏛️', 'architecture', '["tech", "specs"]', 0.0, 'published', ?)
    `,
      ),
      [now, now, now],
    );
    seeded.push("portfolio_items");
  }

  // 4. Spaces
  if ((await tableCount(db, "spaces")) === 0) {
    const now = new Date().toISOString();
    await db.execute(
      bind(
        db,
        `
      INSERT INTO spaces (id, name, description, owner_role, badge, avatar, members_count, is_private, created_at) VALUES
      ('space-design', 'Design System Lab', 'Conception des composants visuels, maquettes et guides d''ergonomie.', 'designer', '🎨', '🎨', 8, 0, ?),
      ('space-dev', 'Développeurs & Intégration', 'Coordination technique, revue de code et déploiements continus.', 'admin', '💻', '💻', 15, 0, ?),
      ('space-gov', 'Gouvernance & Décisions', 'Espace de délibération citoyenne et suivi des votes de la plateforme.', 'auditor', '🏛️', '🏛️', 24, 0, ?)
    `,
      ),
      [now, now, now],
    );
    seeded.push("spaces");
  }

  // 5. Beam channels & initial messages
  if ((await tableCount(db, "beam_channels")) === 0) {
    const nowIso = new Date().toISOString();
    const nowTs = Date.now();
    await db.execute(
      bind(
        db,
        `
      INSERT INTO beam_channels (id, name, description, icon, is_private, created_at) VALUES
      ('chan_general', 'Général', 'Salon d''échange ouvert à tous les membres.', '💬', 0, ?),
      ('chan_annonces', 'Annonces & Mises à jour', 'Informations officielles de la plateforme.', '📢', 0, ?),
      ('chan_entraide', 'Entraide & Questions', 'Partage d''astuces et support entre collègues.', '🤝', 0, ?)
    `,
      ),
      [nowIso, nowIso, nowIso],
    );

    await db.execute(
      bind(
        db,
        `
      INSERT INTO beam_messages (id, channel_id, sender_id, sender_name, sender_avatar, content, timestamp) VALUES
      ('msg_1', 'chan_general', 'admin', 'Alexandre • Administrateur', '👤', 'Bienvenue sur la messagerie Beam ! Vous pouvez échanger ici en temps réel.', ?),
      ('msg_2', 'chan_general', 'designer', 'Éléonore • Designer', '🎨', 'Super, l''interface est très fluide et agréable.', ?)
    `,
      ),
      [nowTs - 600000, nowTs - 300000],
    );
    seeded.push("beam_channels", "beam_messages");
  }

  // 6. Booking slots
  if ((await tableCount(db, "booking_slots")) === 0) {
    await db.execute(`
      INSERT INTO booking_slots (id, title, host_id, start_time, end_time, capacity, booked_count, status) VALUES
      ('slot_1', 'Session Découverte Plateforme', 'admin', '2026-09-28 10:00', '2026-09-28 11:00', 5, 2, 'available'),
      ('slot_2', 'Revue de Design & Expérience Utilisateur', 'designer', '2026-09-28 14:30', '2026-09-28 15:30', 3, 1, 'available'),
      ('slot_3', 'Audit Sécurité & Droits d''accès', 'auditor', '2026-09-29 16:00', '2026-09-29 17:00', 2, 0, 'available')
    `);
    seeded.push("booking_slots");
  }

  // 7. Imperia proposals
  if ((await tableCount(db, "imperia_proposals")) === 0) {
    const now = new Date().toISOString();
    await db.execute(
      bind(
        db,
        `
      INSERT INTO imperia_proposals (id, title, summary, author, status, category, votes_for, votes_against, votes_abstain, ends_at, created_at) VALUES
      ('prop_1', 'Intégration d''un mode hors-ligne pour l''agenda', 'Permettre la consultation des rendez-vous et tâches sans connexion active.', 'Éléonore', 'active', 'technique', 28, 2, 4, '2026-10-15', ?),
      ('prop_2', 'Ouverture d''un fonds de soutien aux créations numériques', 'Allouer 5% des bénéfices de la boutique aux projets créatifs émergents.', 'Julien', 'active', 'solidarité', 45, 3, 1, '2026-10-20', ?)
    `,
      ),
      [now, now],
    );
    seeded.push("imperia_proposals");
  }

  // 8. Solidarity campaigns
  if ((await tableCount(db, "solidarity_campaigns")) === 0) {
    const now = new Date().toISOString();
    await db.execute(
      bind(
        db,
        `
      INSERT INTO solidarity_campaigns (id, title, description, goal_amount, raised_amount, currency, beneficiary, status, created_at) VALUES
      ('camp_1', 'Équipement numérique pour les ateliers locaux', 'Financement de 10 postes de travail reconditionnés pour les espaces communautaires.', 2500.0, 1850.0, 'EUR', 'Association Numérique Pour Tous', 'active', ?),
      ('camp_2', 'Soutien aux projets créatifs indépendants', 'Bourses de création pour artistes et développeurs open source.', 1500.0, 920.0, 'EUR', 'Collectif OpenArt', 'active', ?)
    `,
      ),
      [now, now],
    );
    seeded.push("solidarity_campaigns");
  }

  return seeded;
}
