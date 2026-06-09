import pg from 'pg';
import { MemoryUserStore, type UserRecord, type UserStore } from './user-store.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  openid VARCHAR(64) UNIQUE NOT NULL,
  unionid VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_openid ON users(openid);
`;

export class PostgresUserStore implements UserStore {
  private pool: pg.Pool;
  private ready: Promise<void>;

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(SCHEMA_SQL);
    } finally {
      client.release();
    }
  }

  async findOrCreate(openid: string, unionid?: string): Promise<UserRecord> {
    await this.ready;
    const existing = await this.pool.query<{
      id: string;
      openid: string;
      unionid: string | null;
      created_at: Date;
    }>('SELECT id, openid, unionid, created_at FROM users WHERE openid = $1', [openid]);

    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (unionid && !row.unionid) {
        await this.pool.query('UPDATE users SET unionid = $1 WHERE id = $2', [unionid, row.id]);
        row.unionid = unionid;
      }
      return {
        id: row.id,
        openid: row.openid,
        unionid: row.unionid,
        createdAt: row.created_at.getTime(),
      };
    }

    const id = crypto.randomUUID();
    const inserted = await this.pool.query<{
      id: string;
      openid: string;
      unionid: string | null;
      created_at: Date;
    }>(
      'INSERT INTO users (id, openid, unionid) VALUES ($1, $2, $3) RETURNING id, openid, unionid, created_at',
      [id, openid, unionid ?? null],
    );

    const row = inserted.rows[0];
    return {
      id: row.id,
      openid: row.openid,
      unionid: row.unionid,
      createdAt: row.created_at.getTime(),
    };
  }

  async findById(id: string): Promise<UserRecord | null> {
    await this.ready;
    const result = await this.pool.query<{
      id: string;
      openid: string;
      unionid: string | null;
      created_at: Date;
    }>('SELECT id, openid, unionid, created_at FROM users WHERE id = $1', [id]);

    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      openid: row.openid,
      unionid: row.unionid,
      createdAt: row.created_at.getTime(),
    };
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}

export function createUserStore(databaseUrl: string, usePostgres: boolean): UserStore {
  if (usePostgres && databaseUrl) {
    return new PostgresUserStore(databaseUrl);
  }
  return new MemoryUserStore();
}
