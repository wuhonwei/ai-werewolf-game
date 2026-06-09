export interface UserRecord {
  id: string;
  openid: string;
  unionid: string | null;
  createdAt: number;
}

export interface UserStore {
  findOrCreate(openid: string, unionid?: string): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  disconnect?(): Promise<void>;
}

export class MemoryUserStore implements UserStore {
  private users = new Map<string, UserRecord>();
  private byOpenId = new Map<string, string>();

  async findOrCreate(openid: string, unionid?: string): Promise<UserRecord> {
    const existingId = this.byOpenId.get(openid);
    if (existingId) {
      const user = this.users.get(existingId)!;
      if (unionid && !user.unionid) {
        user.unionid = unionid;
      }
      return { ...user };
    }

    const id = crypto.randomUUID();
    const user: UserRecord = {
      id,
      openid,
      unionid: unionid ?? null,
      createdAt: Date.now(),
    };
    this.users.set(id, user);
    this.byOpenId.set(openid, id);
    return { ...user };
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }
}
