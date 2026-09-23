/**
 * @mosaix-plugin/solara-content-moderator — Solara Content Moderator Plugin
 */

export class SolaraContentModeratorPlugin {
  moderateContent(content: string): void {
    if (content.toLowerCase().includes("spam")) {
      throw new Error("Contenu rejeté : mot proscrit [spam]");
    }
  }
}
