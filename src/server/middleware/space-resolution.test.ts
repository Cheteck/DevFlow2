import { describe, it, expect } from "vitest";
import { resolveSpaceIdFromUrl } from "./space-resolution.js";
import { URL } from "node:url";

describe('space-resolution middleware utilities', () => {
  it('extracts spaceId from URL query', () => {
    const url = new URL('https://example.com/?spaceId=space-123');
    const id = resolveSpaceIdFromUrl(url);
    expect(id).toBe('space-123');
  });

  it('returns null when missing', () => {
    const url = new URL('https://example.com/');
    const id = resolveSpaceIdFromUrl(url);
    expect(id).toBeNull();
  });
});
