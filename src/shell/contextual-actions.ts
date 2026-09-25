import { shellRegistry } from "@mosaix/core";

shellRegistry.register({
  bacId: "shell_home",
  context: {
    title: "Accueil MosaiX",
    subtitle: "Fil d'actualité & Échanges",
    ctaLabel: "Publier un message"
  },
  actions: [
    { id: "feed-for-you", label: "Pour Vous", icon: "dynamic_feed", route: "/", permission: "solara:read:feed" },
    { id: "feed-following", label: "Mes Abonnements", icon: "group", route: "/?filter=following", permission: "solara:read:feed" },
    { id: "feed-moderation", label: "Modération du contenu", icon: "security", route: "/solara/admin/moderation", permission: "solara:moderate:content", badge: "MOD", badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    { id: "feed-admin", label: "Administration", icon: "admin_panel_settings", route: "/imperia", permission: "imperia:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "imperia",
  context: {
    title: "Gouvernance & Débats",
    subtitle: "Consultations & Votes",
    ctaLabel: "Créer un vote"
  },
  actions: [
    { id: "imp-proposals", label: "Propositions & Débats", icon: "how_to_vote", route: "/imperia", permission: "imperia:governance:vote" },
    { id: "imp-new-prop", label: "Nouvelle Proposition", icon: "add_box", route: "/imperia?action=new", permission: "imperia:governance:propose" },
    { id: "imp-delegation", label: "Délégation de Vote", icon: "swap_horiz", route: "/imperia?action=delegate", permission: "imperia:governance:vote" },
    { id: "imp-ff", label: "Options & Fonctionnalités", icon: "toggle_on", route: "/imperia?tab=feature-flags", permission: "imperia:admin:manage", badge: "CONFIG", badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    { id: "imp-admin", label: "Gestion de la plateforme", icon: "gavel", route: "/imperia?admin=true", permission: "imperia:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "identity",
  context: {
    title: "Compte & Sécurité",
    subtitle: "Profil & Préférences",
    ctaLabel: "Gérer mon compte"
  },
  actions: [
    { id: "id-profile", label: "Mon Profil", icon: "account_circle", route: "/identity", permission: "identity:view:profile" },
    { id: "id-security", label: "Sécurité & Accès", icon: "key", route: "/identity?tab=security", permission: "identity:view:profile" },
    { id: "id-admin-users", label: "Gestion des Membres", icon: "manage_accounts", route: "/identity?tab=users", permission: "identity:admin:users", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "commerce",
  context: {
    title: "Boutique en ligne",
    subtitle: "Catalogue & Commandes",
    ctaLabel: "Voir mon Panier"
  },
  actions: [
    { id: "com-catalog", label: "Catalogue Produits", icon: "storefront", route: "/commerce", permission: "commerce:checkout" },
    { id: "com-cart", label: "Mon Panier", icon: "shopping_cart", route: "/commerce?view=cart", permission: "commerce:checkout" },
    { id: "com-inventory", label: "Gestion des Stocks", icon: "inventory_2", route: "/commerce?admin=inventory", permission: "commerce:admin:inventory", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "solidarity",
  context: {
    title: "Entraide & Projets",
    subtitle: "Initiatives Solidaires",
    ctaLabel: "Participer"
  },
  actions: [
    { id: "sol-campaigns", label: "Projets & Campagnes", icon: "volunteer_activism", route: "/solidarity", permission: "solidarity:view:campaigns" },
    { id: "sol-contribute", label: "Proposer de l'Aide", icon: "handshake", route: "/solidarity?view=help", permission: "solidarity:contribute" },
    { id: "sol-admin", label: "Gestion des Fonds", icon: "account_balance_wallet", route: "/solidarity?admin=funds", permission: "solidarity:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "spaces",
  context: {
    title: "Espaces Partagés",
    subtitle: "Équipes & Projets",
    ctaLabel: "Nouvel Espace"
  },
  actions: [
    { id: "spc-dash", label: "Tous mes Espaces", icon: "dashboard", route: "/spaces", permission: "spaces:view:dashboard" },
    { id: "spc-create", label: "Créer un Espace", icon: "create_new_folder", route: "/spaces?action=create", permission: "spaces:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "beam",
  context: {
    title: "Messagerie",
    subtitle: "Discussions & Canaux",
    ctaLabel: "Nouveau Message"
  },
  actions: [
    { id: "bm-chats", label: "Messages Privés", icon: "chat", route: "/beam", permission: "beam:send:message" },
    { id: "bm-channels", label: "Salons Publics", icon: "forum", route: "/beam?view=channels", permission: "beam:send:message" }
  ]
});

shellRegistry.register({
  bacId: "portfolio",
  context: {
    title: "Galerie & Vitrine",
    subtitle: "Œuvres & Créations",
    ctaLabel: "Publier une Œuvre"
  },
  actions: [
    { id: "port-catalog", label: "Galerie Visuelle", icon: "palette", route: "/portfolio", permission: "portfolio:view:catalog" },
    { id: "port-admin", label: "Ajouter une Création", icon: "upload_file", route: "/portfolio?admin=new", permission: "portfolio:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "booking",
  context: {
    title: "Agenda & Rendez-vous",
    subtitle: "Créneaux & Réservations",
    ctaLabel: "Prendre RDV"
  },
  actions: [
    { id: "book-res", label: "Calendrier de Réservation", icon: "calendar_month", route: "/booking", permission: "booking:create:reservation" },
    { id: "book-admin", label: "Gestion du Planning", icon: "edit_calendar", route: "/booking?admin=schedule", permission: "booking:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});
