import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html.js";

describe("escapeHtml utility", () => {
  it("escapes special HTML characters correctly", () => {
    expect(escapeHtml("<script>alert('xss & \"attack\"')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss &amp; &quot;attack&quot;&#39;)&lt;/script&gt;"
    );
  });

  it("handles empty or non-string input safely", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null as unknown as string)).toBe("");
    expect(escapeHtml(undefined as unknown as string)).toBe("");
  });
});
