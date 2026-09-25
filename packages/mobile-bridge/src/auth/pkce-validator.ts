import { createHash } from "node:crypto";

/**
 * Validates OAuth 2.1 PKCE (Proof Key for Code Exchange) parameters
 * RFC 7636 compliant with support for S256 code challenge method.
 */
export class PkceValidator {
  /**
   * Base64URL encoding without padding
   */
  public static base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  /**
   * Computes the S256 code challenge for a given code verifier
   */
  public static computeS256Challenge(codeVerifier: string): string {
    const hash = createHash("sha256").update(codeVerifier, "utf8").digest();
    return this.base64UrlEncode(hash);
  }

  /**
   * Validates code_verifier against stored code_challenge
   */
  public static verify(
    codeVerifier: string,
    codeChallenge: string,
    method: "S256" | "plain" = "S256"
  ): boolean {
    if (!codeVerifier || !codeChallenge) {
      return false;
    }

    // RFC 7636: code_verifier must be between 43 and 128 chars
    if (codeVerifier.length < 43 || codeVerifier.length > 128) {
      return false;
    }

    if (method === "plain") {
      return codeVerifier === codeChallenge;
    }

    if (method === "S256") {
      const calculatedChallenge = this.computeS256Challenge(codeVerifier);
      return calculatedChallenge === codeChallenge;
    }

    return false;
  }
}
