/**
 * @mosaix/core — Effective Permission Resolver & User Authorization Context
 * Implements single authorization engine (ROLE-P1-01 & ROLE-P1-02).
 */

export type PermissionEffect = "ALLOW" | "DENY";

export interface PermissionSource {
  role?: string;
  spaceId?: string;
  organizationId?: string;
  override?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  matchedPermission: string | null;
  effect: PermissionEffect | null;
  source: PermissionSource | null;
}

export interface ResolverContext {
  userId: string;
  spaceId?: string;
  organizationId?: string;
}

export interface RolePermissionRule {
  permissionKey: string;
  effect: PermissionEffect;
  roleKey?: string;
  spaceId?: string;
  organizationId?: string;
}

export interface UserPermissionOverride {
  userId: string;
  spaceId?: string;
  permissionKey: string;
  effect: PermissionEffect;
  expiresAt?: string;
}

export class UserAuthorizationContext {
  constructor(
    public readonly userId: string,
    public readonly spaceId: string | undefined,
    public readonly organizationId: string | undefined,
    public readonly authorizationVersion: number,
    public readonly generatedAt: number,
    public readonly allows: Set<string>,
    public readonly denies: Set<string>,
    public readonly decisionMap: Map<string, PermissionDecision>
  ) {}

  can(permission: string): boolean {
    const decision = this.resolvePermission(permission);
    return decision.allowed;
  }

  resolvePermission(permission: string): PermissionDecision {
    if (this.decisionMap.has(permission)) {
      return this.decisionMap.get(permission)!;
    }

    // DENY > ALLOW absolute rule: check if any matching deny exists
    for (const denyPattern of this.denies) {
      if (matchPermissionPattern(permission, denyPattern)) {
        const decision: PermissionDecision = {
          allowed: false,
          matchedPermission: denyPattern,
          effect: "DENY",
          source: { override: "deny_match", spaceId: this.spaceId },
        };
        this.decisionMap.set(permission, decision);
        return decision;
      }
    }

    // Check if any matching allow exists
    for (const allowPattern of this.allows) {
      if (matchPermissionPattern(permission, allowPattern)) {
        const decision: PermissionDecision = {
          allowed: true,
          matchedPermission: allowPattern,
          effect: "ALLOW",
          source: { override: "allow_match", spaceId: this.spaceId },
        };
        this.decisionMap.set(permission, decision);
        return decision;
      }
    }

    const defaultDecision: PermissionDecision = {
      allowed: false,
      matchedPermission: null,
      effect: null,
      source: null,
    };
    this.decisionMap.set(permission, defaultDecision);
    return defaultDecision;
  }
}

export function matchPermissionPattern(requestPerm: string, patternPerm: string): boolean {
  if (patternPerm === "*") return true;
  const requestSegs = requestPerm.split(":");
  const patternSegs = patternPerm.split(":");

  if (requestSegs.length !== patternSegs.length && patternPerm !== "*") {
    // If scope differs or segment count differs, fail match unless pattern ends with *
    if (patternSegs.length < requestSegs.length && patternSegs[patternSegs.length - 1] === "*") {
      for (let i = 0; i < patternSegs.length - 1; i++) {
        if (patternSegs[i] !== "*" && patternSegs[i] !== requestSegs[i]) return false;
      }
      return true;
    }
    return false;
  }

  return requestSegs.every((seg, idx) => {
    const pat = patternSegs[idx];
    return pat === "*" || seg === "*" || pat === seg;
  });
}

export class EffectivePermissionResolver {
  private globalVersions = new Map<string, number>(); // entityKey -> version

  getVersion(entityKey: string): number {
    return this.globalVersions.get(entityKey) ?? 1;
  }

  bumpVersion(entityKey: string): number {
    const current = this.getVersion(entityKey);
    const next = current + 1;
    this.globalVersions.set(entityKey, next);
    return next;
  }

  buildContext(
    ctx: ResolverContext,
    rules: RolePermissionRule[],
    overrides: UserPermissionOverride[] = []
  ): UserAuthorizationContext {
    const allows = new Set<string>();
    const denies = new Set<string>();
    const decisionMap = new Map<string, PermissionDecision>();

    // 1. Process Role Permission Rules
    for (const rule of rules) {
      if (rule.effect === "DENY") {
        denies.add(rule.permissionKey);
      } else {
        allows.add(rule.permissionKey);
      }
    }

    // 2. Process Overrides (Direct user overrides)
    const nowIso = new Date().toISOString();
    for (const ov of overrides) {
      if (ov.expiresAt && ov.expiresAt < nowIso) continue;
      if (ov.effect === "DENY") {
        denies.add(ov.permissionKey);
      } else {
        allows.add(ov.permissionKey);
      }
    }

    const versionKey = `${ctx.userId}:${ctx.spaceId ?? "global"}`;
    const version = this.getVersion(versionKey);

    return new UserAuthorizationContext(
      ctx.userId,
      ctx.spaceId,
      ctx.organizationId,
      version,
      Date.now(),
      allows,
      denies,
      decisionMap
    );
  }
}

export const effectivePermissionResolver = new EffectivePermissionResolver();
