import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SupabaseAssetRepository } from "../src/index.js";
import { AssetTableRow } from "../src/types.js";

describe("SupabaseAssetRepository — Production Asset Management & Lifecycle", () => {
  const sampleRow = (overrides: Partial<AssetTableRow> = {}): AssetTableRow => ({
    id: "asset-dna-1",
    name: "DNA Helix",
    category: "science",
    category_slug: "nucleic-acids",
    subcategory_id: "sub-dna",
    subcategory_slug: "dna",
    subcategory_name: "DNA",
    type: "svg",
    r2_key: "platform-assets/nucleic-acids/sub-dna/asset-dna-1/dna.svg",
    public_url: "https://cdn.example.com/platform-assets/nucleic-acids/sub-dna/asset-dna-1/dna.svg",
    content_type: "image/svg+xml",
    size_bytes: 4096,
    width: 120,
    height: 120,
    tags: ["cat:nucleic-acids", "subcat:dna", "dna", "genetics"],
    svg_content: "<svg>...</svg>",
    thumbnail_url: "https://cdn.example.com/thumb.svg",
    status: "published",
    content_hash: "hash_dna_123",
    version: 1,
    created_by: "system-admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  describe("Taxonomy & Lifecycle Field Mapping", () => {
    test("mapRowToAsset correctly maps status, version, contentHash, and canonical taxonomy", () => {
      const repo = new SupabaseAssetRepository();
      const asset = repo.mapRowToAsset(sampleRow());

      assert.equal(asset.id, "asset-dna-1");
      assert.equal(asset.name, "DNA Helix");
      assert.equal(asset.categorySlug, "nucleic-acids");
      assert.equal(asset.subcategorySlug, "dna");
      assert.equal(asset.subcategoryName, "DNA");
      assert.equal(asset.status, "published");
      assert.equal(asset.version, 1);
      assert.equal(asset.contentHash, "hash_dna_123");
    });

    test("mapRowToAsset falls back to tags for category_slug and subcategory_slug when columns are null", () => {
      const repo = new SupabaseAssetRepository();
      const asset = repo.mapRowToAsset(
        sampleRow({
          category_slug: null,
          subcategory_slug: null,
          tags: ["cat:cell-types", "subcat:generic-cells"],
        })
      );

      assert.equal(asset.categorySlug, "cell-types");
      assert.equal(asset.subcategorySlug, "generic-cells");
    });

    test("mapRowToAsset defaults status to 'published' and version to 1 for legacy unmigrated rows", () => {
      const repo = new SupabaseAssetRepository();
      const asset = repo.mapRowToAsset(
        sampleRow({
          status: null,
          version: null,
        })
      );

      assert.equal(asset.status, "published");
      assert.equal(asset.version, 1);
    });
  });

  describe("Customer Safety & Status Filtering in list()", () => {
    test("list() defaults to published/legacy assets when no status filter is provided", async () => {
      let executedFilter: string | null = null;

      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "assets");
          return {
            select: () => ({
              order: () => ({
                or: (filterStr: string) => {
                  executedFilter = filterStr;
                  return Promise.resolve({
                    data: [sampleRow({ id: "pub-1", status: "published" })],
                  });
                },
              }),
            }),
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseAssetRepository({ client: mockClient });
      const results = await repo.list();

      assert.equal(results.length, 1);
      assert.equal(executedFilter, "status.eq.published,status.is.null");
    });

    test("list() applies exact status filter when explicitly requested (e.g. status='draft')", async () => {
      let filteredStatus: string | null = null;

      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "assets");
          return {
            select: () => ({
              order: () => ({
                eq: (col: string, val: string) => {
                  if (col === "status") filteredStatus = val;
                  return Promise.resolve({
                    data: [sampleRow({ id: "draft-1", status: "draft" })],
                  });
                },
              }),
            }),
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseAssetRepository({ client: mockClient });
      const results = await repo.list({ status: "draft" });

      assert.equal(results.length, 1);
      assert.equal(filteredStatus, "draft");
      assert.equal(results[0]?.status, "draft");
    });
  });

  describe("Duplicate Content Hash Lookup", () => {
    test("getByHash returns matching asset if content_hash exists", async () => {
      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "assets");
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                assert.equal(col, "content_hash");
                assert.equal(val, "sha256_mock_hash");
                return {
                  maybeSingle: () =>
                    Promise.resolve({
                      data: sampleRow({ content_hash: "sha256_mock_hash" }),
                    }),
                };
              },
            }),
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseAssetRepository({ client: mockClient });
      const match = await repo.getByHash("sha256_mock_hash");

      assert.ok(match);
      assert.equal(match.contentHash, "sha256_mock_hash");
    });

    test("getByHash returns null when hash does not exist or input is empty", async () => {
      const repo = new SupabaseAssetRepository();
      assert.equal(await repo.getByHash(""), null);
    });
  });

  describe("Asset Replacement & Version Increment", () => {
    test("replace() increments asset version and updates storage fields safely", async () => {
      let updatedPayload: Record<string, unknown> | null = null;

      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "assets");
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: sampleRow({ id: "asset-1", version: 1 }),
                  }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              updatedPayload = payload;
              return {
                eq: (col: string, id: string) => {
                  assert.equal(col, "id");
                  assert.equal(id, "asset-1");
                  return {
                    select: () => ({
                      single: () =>
                        Promise.resolve({
                          data: sampleRow({
                            id: "asset-1",
                            version: payload.version as number,
                            r2_key: payload.r2_key as string,
                          }),
                        }),
                    }),
                  };
                },
              };
            },
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseAssetRepository({ client: mockClient });
      const result = await repo.replace("asset-1", {
        r2Key: "platform-assets/nucleic-acids/sub-dna/asset-1/v2-new.svg",
        publicUrl: "https://cdn.example.com/v2-new.svg",
        contentHash: "new_hash_456",
        sizeBytes: 8192,
      });

      assert.ok(updatedPayload);
      assert.equal((updatedPayload as Record<string, unknown>).version, 2);
      assert.equal((updatedPayload as Record<string, unknown>).r2_key, "platform-assets/nucleic-acids/sub-dna/asset-1/v2-new.svg");
      assert.equal(result.version, 2);
    });
  });

  describe("Active Design Dependency Inspection", () => {
    test("isAssetReferencedInDesigns returns referenced=true when asset ID exists in design canvas pages", async () => {
      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "designs");
          return {
            select: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "des-1",
                      name: "Cardiovascular Research Poster",
                      pages: [
                        {
                          id: "page-1",
                          elements: [
                            { id: "el-1", type: "asset", properties: { assetId: "asset-dna-1" } },
                          ],
                        },
                      ],
                    },
                    {
                      id: "des-2",
                      name: "Blank Canvas",
                      pages: [{ id: "page-2", elements: [] }],
                    },
                  ],
                }),
            }),
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseAssetRepository({ client: mockClient });
      const check = await repo.isAssetReferencedInDesigns("asset-dna-1");

      assert.equal(check.referenced, true);
      assert.equal(check.designCount, 1);
      assert.deepEqual(check.designNames, ["Cardiovascular Research Poster"]);
    });

    test("isAssetReferencedInDesigns returns referenced=false when no designs contain the asset", async () => {
      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "designs");
          return {
            select: () => ({
              limit: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "des-1",
                      name: "Other Diagram",
                      pages: [{ id: "page-1", elements: [] }],
                    },
                  ],
                }),
            }),
          };
        },
      };

      // @ts-expect-error injecting mock client
      const repo = new SupabaseAssetRepository({ client: mockClient });
      const check = await repo.isAssetReferencedInDesigns("unused-asset-999");

      assert.equal(check.referenced, false);
      assert.equal(check.designCount, 0);
    });
  });
});
