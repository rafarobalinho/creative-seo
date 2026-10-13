import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type * as ProjectRepositoryModule from "./ProjectRepository";

// SQLite em memória de verdade: o que a exclusão precisa garantir (só apaga
// arquivado, só da própria organização, e leva as linhas filhas junto) é
// comportamento do SQL gerado e do ON DELETE CASCADE, que um mock não enxerga.

vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));

let client: Client;
let ProjectRepository: typeof ProjectRepositoryModule.ProjectRepository;

beforeAll(async () => {
  client = createClient({ url: "file::memory:" });
  const testDb = drizzle(client);
  vi.doMock("@/db", () => ({ db: testDb }));
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      domain TEXT,
      location_code INTEGER NOT NULL DEFAULT 2840,
      language_code TEXT NOT NULL DEFAULT 'en',
      created_at TEXT NOT NULL DEFAULT (current_timestamp),
      archived_at TEXT
    );
    CREATE TABLE aeo_cliente (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  ({ ProjectRepository } = await import("./ProjectRepository"));
});

afterAll(() => {
  client.close();
});

beforeEach(async () => {
  await client.executeMultiple(`
    DELETE FROM aeo_cliente;
    DELETE FROM projects;
    INSERT INTO projects (id, organization_id, name, archived_at) VALUES
      ('ativo', 'org_1', 'Ativo', NULL),
      ('arquivado', 'org_1', 'Arquivado', '2026-10-01 12:00:00'),
      ('arquivado_de_outra_org', 'org_2', 'Outra', '2026-10-01 12:00:00');
    INSERT INTO aeo_cliente (id, project_id) VALUES
      ('cliente_ativo', 'ativo'),
      ('cliente_arquivado', 'arquivado');
  `);
});

async function idsRestantes() {
  const { rows } = await client.execute("SELECT id FROM projects ORDER BY id");
  return rows.map((row) => row.id);
}

describe("deleteArchivedProject", () => {
  it("apaga o projeto arquivado e leva as linhas filhas junto", async () => {
    await expect(
      ProjectRepository.deleteArchivedProject("arquivado", "org_1"),
    ).resolves.toBe(true);

    expect(await idsRestantes()).toEqual(["arquivado_de_outra_org", "ativo"]);
    const { rows } = await client.execute("SELECT id FROM aeo_cliente");
    expect(rows.map((row) => row.id)).toEqual(["cliente_ativo"]);
  });

  it("não apaga projeto ativo", async () => {
    await expect(
      ProjectRepository.deleteArchivedProject("ativo", "org_1"),
    ).resolves.toBe(false);

    expect(await idsRestantes()).toContain("ativo");
  });

  it("não apaga projeto arquivado de outra organização", async () => {
    await expect(
      ProjectRepository.deleteArchivedProject(
        "arquivado_de_outra_org",
        "org_1",
      ),
    ).resolves.toBe(false);

    expect(await idsRestantes()).toContain("arquivado_de_outra_org");
  });
});
