import { describe, expect, it } from "vitest";
import {
  renderPrimarySidebar,
  renderSecondarySidebar,
  renderUserSwitcherWidget,
  renderMobileDrawer,
  renderMobileCreateSheet,
  renderMobileNotificationsSheet,
  renderMobileBottomNav,
  renderCommandPaletteModal,
  renderDevInspectorDrawer,
  renderToastContainer,
} from "./renderer.js";

describe("Shell Renderer Modules", () => {
  it("renders primary and secondary sidebars cleanly", () => {
    const primary = renderPrimarySidebar({ id: "user1", email: "user@test.com", role: "member" }, "/solara", "solara");
    expect(primary).toContain("solara");

    const secondary = renderSecondarySidebar({ activeAppId: "solara", activeRoute: "/feed", currentUser: { id: "user1", email: "user@test.com", role: "member" }, defaultBacId: "solara" });
    expect(secondary).toContain("<nav id=\"mosaix-secondary-sidebar\"");
  });

  it("renders user switcher widget", () => {
    const widget = renderUserSwitcherWidget({ id: "user1", email: "user@test.com", role: "member" });
    expect(widget).toContain("Alex M.");
  });

  it("renders mobile navigation components", () => {
    const drawer = renderMobileDrawer("solara", { id: "user1", email: "user@test.com", role: "member" }, "solara");
    expect(drawer).toContain("solara");

    const createSheet = renderMobileCreateSheet();
    expect(createSheet).toContain("Créer");

    const notifSheet = renderMobileNotificationsSheet();
    expect(notifSheet).toContain("Notifications");

    const bottomNav = renderMobileBottomNav("solara");
    expect(bottomNav).toContain("<nav");
  });

  it("renders modals and drawers", () => {
    const commandPalette = renderCommandPaletteModal();
    expect(commandPalette).toContain("Command Palette");

    const devInspector = renderDevInspectorDrawer();
    expect(devInspector).toContain("Dev Tools");

    const toastContainer = renderToastContainer();
    expect(toastContainer).toContain("toast-container");
  });
});
