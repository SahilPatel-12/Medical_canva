import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_TAXONOMY,
  getCategoryBySlug,
  getSubcategory,
  sanitizeSvg,
  extractSvgColors,
  modifySvgColors,
  EditorStore,
  SAMPLE_ASSETS,
} from "../src/index";
import { Asset, DesignDocument } from "@design-platform/types";

describe("Scientific Taxonomy & Canonical Asset Architecture", () => {
  it("should contain exactly 15 main categories", () => {
    assert.equal(CANONICAL_TAXONOMY.length, 15);
    const expectedCategorySlugs = [
      "cell-types",
      "proteins",
      "nucleic-acids",
      "human-anatomy",
      "lab-and-objects",
      "species",
      "agriculture",
      "membranes",
      "cell-structures",
      "epithelium",
      "lipids-and-carbs",
      "chemistry",
      "graphs-and-symbols",
      "arrows-and-shapes",
      "biomojii",
    ];

    for (const slug of expectedCategorySlugs) {
      const found = getCategoryBySlug(slug);
      assert.ok(found, `Expected category slug '${slug}' to exist in canonical taxonomy`);
    }
  });

  it("should contain all canonical subcategories across the 15 categories (at least 87)", () => {
    let totalSubcategories = 0;
    for (const cat of CANONICAL_TAXONOMY) {
      totalSubcategories += cat.subcategories.length;
    }
    assert.ok(totalSubcategories >= 87, `Expected at least 87 subcategories, got ${totalSubcategories}`);
    assert.equal(totalSubcategories, 102);
  });

  it("should preserve distinct IDs for duplicate-named subcategories under different parents", () => {
    // Nanoparticles under lab-and-objects vs chemistry
    const nanoLab = getSubcategory("lab-and-objects", "nanoparticles");
    const nanoChem = getSubcategory("chemistry", "nanoparticles");

    assert.ok(nanoLab);
    assert.ok(nanoChem);
    assert.equal(nanoLab.name, "Nanoparticles");
    assert.equal(nanoChem.name, "Nanoparticles");
    assert.notEqual(nanoLab.id, nanoChem.id, "Subcategories under different parents must have unique IDs");
    assert.notEqual(nanoLab.categoryId, nanoChem.categoryId);

    // Pathway Proteins under proteins vs graphs-and-symbols
    const pathProtein = getSubcategory("proteins", "pathway-proteins");
    const pathGraph = getSubcategory("graphs-and-symbols", "pathway-proteins");

    assert.ok(pathProtein);
    assert.ok(pathGraph);
    assert.equal(pathProtein.name, "Pathway Proteins");
    assert.equal(pathGraph.name, "Pathway Proteins");
    assert.notEqual(pathProtein.id, pathGraph.id);
  });

  it("should have sample assets mapped to canonical categories and subcategories", () => {
    assert.ok(SAMPLE_ASSETS.length >= 10);
    const antibody = SAMPLE_ASSETS.find((a) => a.id === "asset-protein-antibody");
    assert.ok(antibody);
    assert.equal(antibody.categorySlug, "proteins");
    assert.equal(antibody.subcategorySlug, "antibodies");

    const receptor = SAMPLE_ASSETS.find((a) => a.id === "asset-protein-receptor");
    assert.ok(receptor);
    assert.equal(receptor.categorySlug, "proteins");
    assert.equal(receptor.subcategorySlug, "receptors-and-ligands");
  });
});

describe("Scientific SVG Sanitization & Vector Color Customization", () => {
  const dangerousSvg = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <script>alert("xss")</script>
      <circle cx="50" cy="50" r="40" fill="#2563eb" onclick="evil()" />
      <a href="javascript:void(0)"><path d="M10 10 L90 90" stroke="#000000" /></a>
    </svg>
  `;

  it("should sanitize SVG markup and strip dangerous scripts and handlers", () => {
    const clean = sanitizeSvg(dangerousSvg);
    assert.ok(!clean.includes("<script"), "Must not contain script tags");
    assert.ok(!clean.includes("onclick"), "Must not contain inline onclick handlers");
    assert.ok(!clean.includes("javascript:"), "Must not contain javascript: protocol");
    assert.ok(clean.includes("<circle"), "Must preserve legitimate SVG geometry elements");
    assert.ok(clean.includes('fill="#2563eb"'));
  });

  const multiColorSvg = `
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="30" r="20" fill="#2563eb" stroke="#1d4ed8" />
      <rect x="60" y="60" width="40" height="40" fill="#10b981" />
      <path d="M10 10" stroke="#ef4444" />
    </svg>
  `;

  it("should extract distinct colors from SVG markup", () => {
    const colors = extractSvgColors(multiColorSvg);
    assert.ok(colors.includes("#2563eb"));
    assert.ok(colors.includes("#1d4ed8"));
    assert.ok(colors.includes("#10b981"));
    assert.ok(colors.includes("#ef4444"));
    assert.ok(!colors.includes("none"));
  });

  it("should modify SVG colors globally and via color map", () => {
    // 1. Global fill and stroke tuning
    const tuned = modifySvgColors(multiColorSvg, { fill: "#7c3aed", stroke: "#4f46e5" });
    assert.ok(tuned.includes("#7c3aed"));
    assert.ok(tuned.includes("#4f46e5"));

    // 2. Multi-color map replacement
    const mapped = modifySvgColors(multiColorSvg, {
      colorMap: {
        "#2563eb": "#f59e0b",
        "#10b981": "#ec4899",
      },
    });
    assert.ok(mapped.includes("#f59e0b"));
    assert.ok(mapped.includes("#ec4899"));
  });

  it("should properly manage SVG state and R2 resolution in EditorStore", () => {
    const mockDoc: DesignDocument = {
      id: "doc-test-1",
      name: "Scientific Figure 1",
      width: 1200,
      height: 800,
      backgroundColor: "#ffffff",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pages: [
        {
          id: "page-1",
          name: "Page 1",
          order: 0,
          elements: [],
        },
      ],
    };

    const store = new EditorStore(mockDoc);

    // Create element from an asset with remote R2 URL
    const r2Asset: Asset = {
      id: "asset-remote-antibody",
      name: "Monoclonal Antibody",
      type: "svg",
      category: "proteins",
      categorySlug: "proteins",
      subcategorySlug: "antibodies",
      source: "https://r2.medicalcanva.com/assets/proteins/antibody.svg",
      url: "https://r2.medicalcanva.com/assets/proteins/antibody.svg",
    };

    const element = store.createFromAsset(r2Asset, { x: 100, y: 100 });
    store.addElement(element);

    assert.equal(element.properties.assetId, "asset-remote-antibody");
    assert.equal(element.properties.category, "proteins");
    assert.equal(element.properties.subcategorySlug, "antibodies");

    // Asynchronously resolved XML markup replaces the URL placeholder
    const realSvgXml = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#3b82f6" /></svg>`;
    store.resolveAssetSvgMarkup(element.id, realSvgXml);

    const updated = store.getElementById(element.id);
    assert.ok(updated);
    assert.equal(updated.properties.svgContent, realSvgXml);
    assert.equal(updated.properties.originalSvg, realSvgXml);

    // Select and update vector color
    store.selectElement(element.id);
    store.updateSelectedSvgColor("#ef4444", "#991b1b");

    const recolored = store.getSelectedElement();
    assert.ok(recolored);
    assert.equal(recolored.properties.fill, "#ef4444");
    assert.ok((recolored.properties.svgContent as string).includes("#ef4444"));

    // Reset original colors
    store.resetSelectedSvgColors();
    const reset = store.getSelectedElement();
    assert.ok(reset);
    assert.equal(reset.properties.fill, undefined);
    assert.equal(reset.properties.svgContent, realSvgXml);
  });
});
