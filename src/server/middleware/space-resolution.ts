import type { URL } from "node:url";
import type { SpaceProfile } from "../../shell/profiles.js";

export interface SpaceRequestContext {
  spaceId: string;
  space?: SpaceProfile;
}

export function resolveSpaceIdFromUrl(url: URL): string | null {
  return url.searchParams.get("spaceId") || null;
}