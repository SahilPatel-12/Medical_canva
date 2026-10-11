import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SupabaseDesignRepository } from "../src/index.js";

describe("SupabaseDesignRepository — Phase 3 Workspace Scoping & Data Isolation", () => {
  const WS_A = "11111111-1111-1111-1111-111111111111";
  const WS_B = "22222222-2222-2222-2222-222222222222";

  describe("Unscoped Query Guardrails", () => {
    test("list() without workspace returns empty array to prevent cross-workspace data leakage", async () => {
      const mockClient = {
        from: () => {
          assert.fail("Database query should never execute when workspaceId is missing");
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseDesignRepository({ client: mockClient });
      const results = await repo.list();
      assert.deepEqual(results, []);
    });

    test("create() without workspaceId throws validation error", async () => {
      const mockClient = {
        from: () => {
          assert.fail("Database insert should not run without workspaceId");
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseDesignRepository({ client: mockClient });
      await assert.rejects(
        () => repo.create({ name: "Unscoped Design", width: 1200, height: 800 }),
        /workspaceId is required/
      );
    });
  });

  describe("Workspace-Scoped Queries & Filtering", () => {
    test("list() applies workspace_id filter on database query", async () => {
      let filteredWorkspaceId: string | null = null;

      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "designs");
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                assert.equal(col, "workspace_id");
                filteredWorkspaceId = val;
                return {
                  order: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: "des-a1",
                          workspace_id: WS_A,
                          name: "Design in Workspace A",
                          width: 1200,
                          height: 800,
                          background_color: "#ffffff",
                          pages: [],
                          favorite: false,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        },
                      ],
                      error: null,
                    }),
                };
              },
            }),
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseDesignRepository({ client: mockClient, workspaceId: WS_A });
      const designs = await repo.list();

      assert.equal(filteredWorkspaceId, WS_A);
      assert.equal(designs.length, 1);
      assert.equal(designs[0]!.id, "des-a1");
      assert.equal(designs[0]!.workspaceId, WS_A);
    });

    test("getById() includes workspace_id check to prevent unauthorized cross-workspace lookups", async () => {
      let queriedId: string | null = null;
      let queriedWsId: string | null = null;

      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "designs");
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                if (col === "id") queriedId = val;
                return {
                  eq: (col2: string, val2: string) => {
                    if (col2 === "workspace_id") queriedWsId = val2;
                    return {
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    };
                  },
                };
              },
            }),
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseDesignRepository({ client: mockClient, workspaceId: WS_A });
      const result = await repo.getById("des-b1");

      assert.equal(queriedId, "des-b1");
      assert.equal(queriedWsId, WS_A);
      assert.equal(result, null);
    });
  });

  describe("Two-Account Cross-Workspace Isolation Scenarios", () => {
    // In-memory multi-tenant simulated database
    const dbDesigns: Array<{
      id: string;
      workspace_id: string;
      name: string;
      width: number;
      height: number;
      background_color: string;
      pages: unknown[];
      favorite: boolean;
      created_at: string;
      updated_at: string;
    }> = [];

    const createSimulatedClient = (callerWorkspace: string) => ({
      from: (table: string) => {
        assert.equal(table, "designs");
        return {
          select: () => ({
            eq: (col: string, wsId: string) => {
              assert.equal(col, "workspace_id");
              return {
                order: () => {
                  // Simulate RLS: Only rows matching caller workspace are visible
                  const matched = dbDesigns.filter((d) => d.workspace_id === wsId && wsId === callerWorkspace);
                  return Promise.resolve({ data: matched, error: null });
                },
              };
            },
          }),
          insert: (rows: Array<Record<string, unknown>>) => ({
            select: () => ({
              single: () => {
                const row = rows[0]!;
                // Simulate RLS WITH CHECK: Cannot insert into foreign workspace
                if (row.workspace_id !== callerWorkspace) {
                  return Promise.resolve({
                    data: null,
                    error: { message: "new row violates row-level security policy" },
                  });
                }
                const inserted = {
                  id: `des_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  workspace_id: row.workspace_id as string,
                  name: row.name as string,
                  width: row.width as number,
                  height: row.height as number,
                  background_color: row.background_color as string,
                  pages: (row.pages as unknown[]) || [],
                  favorite: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                dbDesigns.push(inserted);
                return Promise.resolve({ data: inserted, error: null });
              },
            }),
          }),
        };
      },
    });

    test("User A creates Design A; User B creates Design B — data remains strictly isolated", async () => {
      // 1. User A in Workspace A creates Design A
      const clientA = createSimulatedClient(WS_A);
      // @ts-expect-error injecting mock client
      const repoA = new SupabaseDesignRepository({ client: clientA, workspaceId: WS_A });
      const docA = await repoA.create({
        name: "Cardiology Flowchart A",
        width: 1200,
        height: 800,
        workspaceId: WS_A,
      });

      assert.equal(docA.name, "Cardiology Flowchart A");
      assert.equal(docA.workspaceId, WS_A);

      // 2. User B in Workspace B creates Design B
      const clientB = createSimulatedClient(WS_B);
      // @ts-expect-error injecting mock client
      const repoB = new SupabaseDesignRepository({ client: clientB, workspaceId: WS_B });
      const docB = await repoB.create({
        name: "Genetics Poster B",
        width: 1200,
        height: 800,
        workspaceId: WS_B,
      });

      assert.equal(docB.name, "Genetics Poster B");
      assert.equal(docB.workspaceId, WS_B);

      // 3. User A lists designs — MUST ONLY see Design A
      const listA = await repoA.list();
      assert.equal(listA.length, 1);
      assert.equal(listA[0]!.name, "Cardiology Flowchart A");
      assert.equal(listA[0]!.workspaceId, WS_A);

      // 4. User B lists designs — MUST ONLY see Design B
      const listB = await repoB.list();
      assert.equal(listB.length, 1);
      assert.equal(listB[0]!.name, "Genetics Poster B");
      assert.equal(listB[0]!.workspaceId, WS_B);
    });

    test("User A cannot delete or modify Design B", async () => {
      const clientA = {
        from: () => ({
          delete: () => ({
            eq: (_col1: string, _val1: string) => ({
              eq: (_col2: string, val2: string) => {
                // If caller is WS_A, the query looks for design id in WS_A
                assert.equal(val2, WS_A);
                return Promise.resolve({ data: null, error: null });
              },
            }),
          }),
          update: (_updates: unknown) => ({
            eq: (_col1: string, _val1: string) => ({
              eq: (_col2: string, val2: string) => {
                assert.equal(val2, WS_A);
                // Return null because row in WS_B does not match WS_A filter
                return {
                  select: () => ({
                    single: () => Promise.resolve({ data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } }),
                  }),
                };
              },
            }),
          }),
        }),
      };

      // @ts-expect-error injecting mock client
      const repoA = new SupabaseDesignRepository({ client: clientA, workspaceId: WS_A });

      // User A attempts to update a design with ID 'des-b1' (which lives in WS_B)
      await assert.rejects(
        () => repoA.update("des-b1", { name: "Hacked" }),
        /Failed to update design/
      );
    });

    test("Account switching cleanly changes workspace boundary and isolates data", async () => {
      let activeWs = WS_A;
      const client = {
        from: () => ({
          select: () => ({
            eq: (_col: string, val: string) => ({
              order: () => {
                if (val === WS_A) {
                  return Promise.resolve({
                    data: [
                      {
                        id: "des-a1",
                        workspace_id: WS_A,
                        name: "User A Flowchart",
                        width: 1200,
                        height: 800,
                        background_color: "#ffffff",
                        pages: [],
                        favorite: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      },
                    ],
                    error: null,
                  });
                }
                if (val === WS_B) {
                  return Promise.resolve({
                    data: [
                      {
                        id: "des-b1",
                        workspace_id: WS_B,
                        name: "User B Report",
                        width: 1200,
                        height: 800,
                        background_color: "#ffffff",
                        pages: [],
                        favorite: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      },
                    ],
                    error: null,
                  });
                }
                return Promise.resolve({ data: [], error: null });
              },
            }),
          }),
        }),
      };

      // Session 1: User A is logged in
      // @ts-expect-error injecting mock client
      const repo = new SupabaseDesignRepository({ client, workspaceId: activeWs });
      const listA = await repo.list();
      assert.equal(listA.length, 1);
      assert.equal(listA[0]!.name, "User A Flowchart");

      // Session 2: User A logs out and User B logs in
      repo.setWorkspaceId(WS_B);
      const listB = await repo.list();
      assert.equal(listB.length, 1);
      assert.equal(listB[0]!.name, "User B Report");
      assert.equal(listB[0]!.workspaceId, WS_B);

      // Session 3: User B logs out, unauthenticated visitor
      repo.setWorkspaceId(undefined);
      const listAnon = await repo.list();
      assert.deepEqual(listAnon, []);
    });
  });

  describe("Error Safety & No Silent Fallback", () => {
    test("database errors throw explicitly rather than silently exposing fallback data", async () => {
      const mockClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: null,
                  error: { message: "Database connection timeout" },
                }),
            }),
          }),
        }),
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseDesignRepository({ client: mockClient, workspaceId: WS_A });

      await assert.rejects(
        () => repo.list(),
        /Failed to list designs: Database connection timeout/
      );
    });
  });
});
