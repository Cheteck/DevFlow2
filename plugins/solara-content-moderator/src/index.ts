/**
 * @mosaix-plugin/solara-content-moderator — Solara Content Moderator Plugin
 */

export interface SolaraContentModeratorOptions {
  prohibitedWords?: string[];
}

export class SolaraContentModeratorPlugin {
  private readonly prohibitedWords: string[];

  constructor(options: SolaraContentModeratorOptions = {}) {
    this.prohibitedWords = options.prohibitedWords ?? ["spam", "scam", "phishing"];
  }

  moderateContent(content: string): void {
    const lower = content.toLowerCase();
    for (const word of this.prohibitedWords) {
      if (lower.includes(word.toLowerCase())) {
        throw new Error(`Contenu rejeté : mot proscrit [${word}]`);
      }
    }
  }
}
