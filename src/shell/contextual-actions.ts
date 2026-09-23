import { shellRegistry } from "@mosaix/core";

shellRegistry.register({
  bacId: "shell_home",
  context: {
    title: "MosaiX Network",
    subtitle: "Réseau Social Unifié",
    ctaLabel: "Nouveau Pulse"
  },
  actions: [
    { id: "feed-for-you", label: "Pour Vous", icon: "dynamic_feed", route: "/", permission: "solara:read:feed" },
    { id: "feed-following", label: "Abonnements", icon: "group", route: "/?filter=following", permission: "solara:read:feed" },
    { id: "feed-moderation", label: "Modération Solara", icon: "security", route: "/solara/admin/moderation", permission: "solara:moderate:content", badge: "MOD", badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    { id: "feed-admin", label: "Gouvernance Sénat", icon: "admin_panel_settings", route: "/imperia", permission: "imperia:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "imperia",
  context: {
    title: "Imperia Governance",
    subtitle: "Sénat & Votes DDA",
    ctaLabel: "Soumettre Vote"
  },
  actions: [
    { id: "imp-proposals", label: "Propositions de Loi", icon: "how_to_vote", route: "/imperia", permission: "imperia:governance:vote" },
    { id: "imp-new-prop", label: "Créer une Proposition", icon: "add_box", route: "/imperia?action=new", permission: "imperia:governance:propose" },
    { id: "imp-delegation", label: "Délégation de Vote", icon: "swap_horiz", route: "/imperia?action=delegate", permission: "imperia:governance:vote" },
    { id: "imp-ff", label: "Feature Flags", icon: "toggle_on", route: "/imperia?tab=feature-flags", permission: "imperia:admin:manage", badge: "FLAGS", badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    { id: "imp-admin", label: "Console d'Administration", icon: "gavel", route: "/imperia?admin=true", permission: "imperia:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "identity",
  context: {
    title: "Identity & Access",
    subtitle: "Authentification SSO",
    ctaLabel: "Mon Profil SSO"
  },
  actions: [
    { id: "id-profile", label: "Tableau de Bord Profil", icon: "account_circle", route: "/identity", permission: "identity:view:profile" },
    { id: "id-security", label: "Clés & Sécurité API", icon: "key", route: "/identity?tab=security", permission: "identity:view:profile" },
    { id: "id-admin-users", label: "Gestion des Utilisateurs", icon: "manage_accounts", route: "/identity?tab=users", permission: "identity:admin:users", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "commerce",
  context: {
    title: "Commerce Engine",
    subtitle: "Boutique & Transaction",
    ctaLabel: "Voir Panier"
  },
  actions: [
    { id: "com-catalog", label: "Catalogue Produits", icon: "storefront", route: "/commerce", permission: "commerce:checkout" },
    { id: "com-cart", label: "Panier & Commandes", icon: "shopping_cart", route: "/commerce?view=cart", permission: "commerce:checkout" },
    { id: "com-inventory", label: "Gestion des Stocks", icon: "inventory_2", route: "/commerce?admin=inventory", permission: "commerce:admin:inventory", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "solidarity",
  context: {
    title: "Solidarity Hub",
    subtitle: "Entraide Communautaire",
    ctaLabel: "Faire un Don"
  },
  actions: [
    { id: "sol-campaigns", label: "Campagnes Actives", icon: "volunteer_activism", route: "/solidarity", permission: "solidarity:view:campaigns" },
    { id: "sol-contribute", label: "Participer à l'Aide", icon: "handshake", route: "/solidarity?view=help", permission: "solidarity:contribute" },
    { id: "sol-admin", label: "Gestion des Fonds", icon: "account_balance_wallet", route: "/solidarity?admin=funds", permission: "solidarity:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "spaces",
  context: {
    title: "Spaces Module",
    subtitle: "Espaces de Travail",
    ctaLabel: "Nouveau Space"
  },
  actions: [
    { id: "spc-dash", label: "Mes Espaces", icon: "dashboard", route: "/spaces", permission: "spaces:view:dashboard" },
    { id: "spc-create", label: "Créer un Espace", icon: "create_new_folder", route: "/spaces?action=create", permission: "spaces:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "beam",
  context: {
    title: "Beam Messenger",
    subtitle: "Messagerie & Salons",
    ctaLabel: "Nouveau Message"
  },
  actions: [
    { id: "bm-chats", label: "Conversations Directes", icon: "chat", route: "/beam", permission: "beam:send:message" },
    { id: "bm-channels", label: "Canaux Communautaires", icon: "forum", route: "/beam?view=channels", permission: "beam:send:message" }
  ]
});

shellRegistry.register({
  bacId: "portfolio",
  context: {
    title: "Portfolio Catalog",
    subtitle: "Vitrine Créative",
    ctaLabel: "Ajouter Œuvre"
  },
  actions: [
    { id: "port-catalog", label: "Galerie d'Art", icon: "palette", route: "/portfolio", permission: "portfolio:view:catalog" },
    { id: "port-admin", label: "Publier une Création", icon: "upload_file", route: "/portfolio?admin=new", permission: "portfolio:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});

shellRegistry.register({
  bacId: "booking",
  context: {
    title: "Booking Service",
    subtitle: "Réservation & Agenda",
    ctaLabel: "Prendre RDV"
  },
  actions: [
    { id: "book-res", label: "Calendrier de Réservation", icon: "calendar_month", route: "/booking", permission: "booking:create:reservation" },
    { id: "book-admin", label: "Gestion du Planning", icon: "edit_calendar", route: "/booking?admin=schedule", permission: "booking:admin:manage", badge: "ADMIN", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
  ]
});
