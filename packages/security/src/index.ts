export interface UserContext {
  sub: string;
  roles?: string[];
  permissions?: string[];
}

export class Policy {
  private rules = new Map<string, (user: UserContext, resource?: unknown) => boolean>();

  define(name: string, check: (user: UserContext, resource?: unknown) => boolean): void {
    this.rules.set(name, check);
  }

  evaluate(name: string, user: UserContext, resource?: unknown): boolean {
    const rule = this.rules.get(name);
    if (!rule) return false;
    return rule(user, resource);
  }
}

export class Guard {
  constructor(private policy?: Policy) {}

  async authorize(user: UserContext | null, requiredPermission: string, resource?: unknown): Promise<void> {
    if (!user) {
      throw new Error("Unauthorized: No user context found.");
    }
    const roles = user.roles || [];
    const permissions = user.permissions || [];

    if (this.policy) {
      if (this.policy.evaluate(requiredPermission, user, resource)) {
        return;
      }
    }

    if (roles.includes("admin") || roles.includes("platform-governor") || permissions.includes(requiredPermission)) {
      return;
    }
    throw new Error(`Forbidden: Required permission '${requiredPermission}' not granted.`);
  }
}

export const Security = { Guard, Policy };

