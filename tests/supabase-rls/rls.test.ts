/**
 * Row-level security tests for supabase/migrations, run in-process on PGlite
 * (real Postgres compiled to WASM) with a minimal stand-in for Supabase's
 * `auth` schema and roles. No Docker or network needed.
 */
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";
let pg: PGlite;

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  insert into auth.users values ('${ALICE}'), ('${BOB}');
`;

async function as<T>(who: string | null, fn: () => Promise<T>): Promise<T> {
  await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '${who ?? ""}', false);`);
  await pg.exec(who ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await pg.exec("reset role");
  }
}

const insertNote = (id: string, owner?: string) =>
  pg.query(
    `insert into public.notes (${owner ? "user_id, " : ""}id, data, updated_at) values (${owner ? "$4, " : ""}$1, $2, $3)`,
    owner ? [id, { id, title: "T" }, 1, owner] : [id, { id, title: "T" }, 1],
  );

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  }
});

describe("notes RLS", () => {
  it("owner can insert (user_id defaults to auth.uid()), read, update, delete", async () => {
    await as(ALICE, async () => {
      await insertNote("n1");
      const r = await pg.query<{ user_id: string }>("select user_id from public.notes where id = 'n1'");
      expect(r.rows).toEqual([{ user_id: ALICE }]);
      await pg.query("update public.notes set updated_at = 2 where id = 'n1'");
      await pg.query("insert into public.notes (id, data, updated_at) values ('n2', '{}', 1)");
      await pg.query("delete from public.notes where id = 'n2'");
      expect((await pg.query("select id from public.notes")).rows.length).toBe(1);
    });
  });

  it("other users see nothing and can't write as someone else", async () => {
    await as(BOB, async () => {
      expect((await pg.query("select * from public.notes")).rows).toEqual([]);
      const upd = await pg.query("update public.notes set updated_at = 9 where id = 'n1'");
      expect(upd.affectedRows).toBe(0);
      const del = await pg.query("delete from public.notes where id = 'n1'");
      expect(del.affectedRows).toBe(0);
      await expect(insertNote("x", ALICE)).rejects.toThrow(/row-level security/);
    });
  });

  it("guests (anon) have no access", async () => {
    await as(null, async () => {
      await expect(pg.query("select * from public.notes")).rejects.toThrow(/permission denied/);
      await expect(insertNote("g")).rejects.toThrow(/permission denied/);
    });
  });

  it("the server stamps server_updated_at (clients can't backdate it)", async () => {
    await as(ALICE, async () => {
      await pg.query("update public.notes set server_updated_at = '2000-01-01' where id = 'n1'");
      const r = await pg.query<{ y: number }>("select extract(year from server_updated_at)::int as y from public.notes where id = 'n1'");
      expect(r.rows[0].y).toBeGreaterThan(2020);
    });
  });

  it("rejects oversized or malformed rows", async () => {
    await as(ALICE, async () => {
      await expect(pg.query("insert into public.notes (id, data, updated_at) values ('', '{}', 1)")).rejects.toThrow();
      await expect(pg.query(`insert into public.notes (id, data, updated_at) values ('big', $1, 1)`, [{ x: "a".repeat(1_000_001) }])).rejects.toThrow();
    });
  });
});

describe("folders RLS", () => {
  it("owner only, name length capped", async () => {
    await as(ALICE, async () => {
      await pg.query(`insert into public.folders (id, data, updated_at) values ('f1', '{"name":"Work"}', 1)`);
      await expect(pg.query(`insert into public.folders (id, data, updated_at) values ('f2', $1, 1)`, [{ name: "x".repeat(201) }])).rejects.toThrow();
    });
    await as(BOB, async () => {
      expect((await pg.query("select * from public.folders")).rows).toEqual([]);
    });
  });
});
