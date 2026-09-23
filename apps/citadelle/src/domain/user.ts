import type { UserModel } from "./user.model.js";

export class User implements UserModel {
  constructor(
    public readonly id: string,
    public email: string,
    public displayName: string,
    public readonly createdAt: string = new Date().toISOString(),
    public updatedAt: string = new Date().toISOString(),
  ) {}
}
