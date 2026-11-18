import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_TAXONOMY,
  getCategoryBySlug,
  getSubcategory,
  sanitizeSvg,
  extractSvgColors,
  modifySvgColors,
  extractSvgSubComponents,
  decomposeSvgComponents,
  modifySvgComponentColor,
  applyScientificPreset,
  SCIENTIFIC_COLOR_PRESETS,
  EditorStore,
  SAMPLE_ASSETS,
} from "../src/index";
import { Asset, DesignDocument, SvgProperties } from "@design-platform/types";

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

  it("ships only basic shapes as built-in assets (the scientific library comes from the asset store)", () => {
    assert.equal(SAMPLE_ASSETS.length, 5);
    for (const asset of SAMPLE_ASSETS) {
      assert.equal(asset.categorySlug, "arrows-and-shapes");
      const category = CANONICAL_TAXONOMY.find((c) => c.slug === asset.categorySlug);
      assert.ok(category?.subcategories.some((s) => s.slug === asset.subcategorySlug), asset.id);
    }
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

    const assetProps = element.properties as Record<string, unknown>;
    assert.equal(assetProps.assetId, "asset-remote-antibody");
    assert.equal(assetProps.category, "proteins");
    assert.equal(assetProps.subcategorySlug, "antibodies");

    // Asynchronously resolved XML markup replaces the URL placeholder
    const realSvgXml = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#3b82f6" /></svg>`;
    store.resolveAssetSvgMarkup(element.id, realSvgXml);

    const updated = store.getElementById(element.id);
    assert.ok(updated);
    const updatedSvgProps = updated.properties as SvgProperties;
    assert.equal(updatedSvgProps.svgContent, realSvgXml);
    assert.equal(updatedSvgProps.originalSvg, realSvgXml);

    // Select and update vector color
    store.selectElement(element.id);
    store.updateSelectedSvgColor("#ef4444", "#991b1b");

    const recolored = store.getSelectedElement();
    assert.ok(recolored);
    const recoloredSvgProps = recolored.properties as SvgProperties;
    assert.equal(recoloredSvgProps.fill, "#ef4444");
    assert.ok((recoloredSvgProps.svgContent as string).includes("#ef4444"));

    // Reset original colors
    store.resetSelectedSvgColors();
    const reset = store.getSelectedElement();
    assert.ok(reset);
    const resetSvgProps = reset.properties as SvgProperties;
    assert.equal(resetSvgProps.fill, undefined);
    assert.equal(resetSvgProps.svgContent, realSvgXml);
  });

  describe("BioRender Style Scientific Presets & Component Distribution", () => {
    const coronavirusSvg = `
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <g id="membrane" fill="#2563eb" stroke="#1d4ed8">
          <circle cx="100" cy="100" r="60" />
        </g>
        <g id="spike-glycoprotein" fill="#10b981" stroke="#047857">
          <path d="M100 20 L105 40 L95 40 Z" />
          <path d="M180 100 L160 105 L160 95 Z" />
        </g>
        <g id="rna-core" fill="#f59e0b" stroke="#b45309">
          <circle cx="100" cy="100" r="30" />
        </g>
      </svg>
    `;

    it("should extract subcomponents with identifiers, tags, and colors", () => {
      const components = extractSvgSubComponents(coronavirusSvg);
      assert.equal(components.length, 3);

      assert.equal(components[0]?.id, "membrane");
      assert.equal(components[0]?.fill, "#2563eb");
      assert.ok(components[0]?.svgMarkup.includes("<svg"));

      assert.equal(components[1]?.id, "spike-glycoprotein");
      assert.equal(components[1]?.fill, "#10b981");

      assert.equal(components[2]?.id, "rna-core");
      assert.equal(components[2]?.fill, "#f59e0b");
    });

    it("should decompose an SVG illustration into standalone element objects", () => {
      const decomposed = decomposeSvgComponents(coronavirusSvg, "Coronavirus");
      assert.equal(decomposed.length, 3);
      assert.ok(decomposed[0]?.name.includes("Coronavirus"));
      assert.ok(decomposed[0]?.svgContent.includes("<svg"));
      // Tight bounds include the 1-unit stroke (r=60 circle + 0.5 stroke overflow) so it is never clipped
      assert.ok(decomposed[0]?.svgContent.includes('viewBox="39.5 39.5 121 121"'));
      // Inherited group styling is preserved on the detached part
      assert.ok(decomposed[0]?.svgContent.includes('fill="#2563eb"'));
    });

    it("should modify individual subcomponent color without affecting other components", () => {
      // Recolor only the spike-glycoprotein to Bio Red (#ef4444)
      const recolored = modifySvgComponentColor(coronavirusSvg, "spike-glycoprotein", {
        fill: "#ef4444",
        stroke: "#b91c1c",
      });

      assert.ok(recolored.includes('fill="#ef4444"'), "Spike should now have Bio Red fill");
      assert.ok(recolored.includes('stroke="#b91c1c"'), "Spike should have Bio Red stroke");
      assert.ok(recolored.includes('fill="#2563eb"'), "Membrane fill must remain intact");
      assert.ok(recolored.includes('fill="#f59e0b"'), "RNA core fill must remain intact");
    });

    it("should apply scientific preset (Bio Red) to an SVG or specific component", () => {
      const bioRedPreset = SCIENTIFIC_COLOR_PRESETS.find((p) => p.id === "bio-red");
      assert.ok(bioRedPreset);
      assert.equal(bioRedPreset.primary, "#ef4444");
      assert.equal(bioRedPreset.secondary, "#b91c1c");

      // 1. Component level
      const compPreset = applyScientificPreset(coronavirusSvg, "bio-red", "membrane");
      assert.ok(compPreset.includes('fill="#ef4444"'));

      // 2. Global preset level
      const globalPreset = applyScientificPreset(coronavirusSvg, "bio-red");
      assert.ok(globalPreset.includes("#ef4444"));
      assert.ok(globalPreset.includes("#b91c1c"));
    });

    it("should distribute SVG into independent canvas elements in EditorStore with undo/redo", () => {
      const doc: DesignDocument = {
        id: "doc-distribute-test",
        name: "Viral Assembly",
        width: 1000,
        height: 1000,
        backgroundColor: "#ffffff",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: [
          {
            id: "page-1",
            name: "Page 1",
            elements: [],
          },
        ],
      };

      const store = new EditorStore(doc);
      const compositeElement = {
        id: "elem-composite-coronavirus",
        type: "svg" as const,
        name: "Coronavirus (M, membrane protein)",
        x: 200,
        y: 200,
        width: 300,
        height: 300,
        rotation: 0,
        opacity: 1,
        properties: {
          svgContent: coronavirusSvg,
          originalSvg: coronavirusSvg,
        },
      };

      store.addElement(compositeElement);
      store.selectElement(compositeElement.id);

      // Perform distribution of the 3 components
      const distributed = store.distributeSelectedSvgComponents();
      assert.ok(distributed);
      assert.equal(distributed.length, 3);

      const activePage = store.getActivePage();
      assert.ok(activePage);
      // The original composite element has been replaced by the 3 decomposed components
      assert.equal(activePage.elements.length, 3);
      assert.ok(!activePage.elements.some((el) => el.id === compositeElement.id));

      // Each component is a valid SVG element on canvas with accurate tight bounding box
      // (viewBox 200 → 300px = 1.5x; bounds include the 0.5-unit stroke overflow)
      assert.equal(activePage.elements[0]?.type, "svg");
      assert.equal(activePage.elements[0]?.x, 259.25);
      assert.equal(activePage.elements[0]?.y, 259.25);
      assert.equal(activePage.elements[0]?.width, 181.5);
      assert.equal(activePage.elements[0]?.height, 181.5);

      // RNA core element is accurately positioned at center with tight bounds
      assert.equal(activePage.elements[2]?.type, "svg");
      assert.equal(activePage.elements[2]?.x, 304.25);
      assert.equal(activePage.elements[2]?.y, 304.25);
      assert.equal(activePage.elements[2]?.width, 91.5);
      assert.equal(activePage.elements[2]?.height, 91.5);

      // Test Undo: restores composite element
      store.undo();
      const pageAfterUndo = store.getActivePage();
      assert.ok(pageAfterUndo);
      assert.equal(pageAfterUndo.elements.length, 1);
      assert.equal(pageAfterUndo.elements[0]?.id, compositeElement.id);

      // Test Redo: re-applies distribution
      store.redo();
      const pageAfterRedo = store.getActivePage();
      assert.ok(pageAfterRedo);
      assert.equal(pageAfterRedo.elements.length, 3);
    });

    it("should allow editing fill, stroke line color, and stroke width independently on separated objects", () => {
      const doc: DesignDocument = {
        id: "doc-edit-separate",
        name: "Separate Objects",
        width: 1000,
        height: 1000,
        backgroundColor: "#ffffff",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: [{ id: "page-1", name: "Page 1", elements: [] }],
      };

      const store = new EditorStore(doc);
      // An individual separated object element (e.g. membrane path)
      const objectElement = {
        id: "elem-object-1",
        type: "svg" as const,
        name: "Cell Membrane Object",
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rotation: 0,
        opacity: 1,
        properties: {
          svgContent: `<svg viewBox="0 0 100 100"><path d="M10 10 L90 90" fill="#2563eb" stroke="#1d4ed8" stroke-width="2" /></svg>`,
          originalSvg: `<svg viewBox="0 0 100 100"><path d="M10 10 L90 90" fill="#2563eb" stroke="#1d4ed8" stroke-width="2" /></svg>`,
          fill: "#2563eb",
          stroke: "#1d4ed8",
        },
      };

      store.addElement(objectElement);
      store.selectElement(objectElement.id);

      // 1. Change ONLY the line/stroke color to Bio Red (#ef4444)
      store.updateSelectedSvgColor(undefined, "#ef4444");
      let selected = store.getSelectedElement();
      assert.ok(selected);
      let props = selected.properties as SvgProperties;
      assert.equal(props.fill, "#2563eb", "Existing fill must not be wiped out when editing line color");
      assert.equal(props.stroke, "#ef4444", "Stroke line color must be updated to #ef4444");
      assert.ok((props.svgContent as string).includes('stroke="#ef4444"'));

      // 2. Change ONLY the stroke width to 6px
      store.updateSelectedSvgColor(undefined, undefined, 6);
      selected = store.getSelectedElement();
      assert.ok(selected);
      props = selected.properties as SvgProperties & { strokeWidth?: number };
      assert.equal(props.fill, "#2563eb", "Fill remains intact");
      assert.equal(props.stroke, "#ef4444", "Stroke remains intact");
      assert.equal(props.strokeWidth, 6, "Stroke width updated to 6");
      assert.ok((props.svgContent as string).includes('stroke-width="6"'));

      // 3. Change ONLY the object fill color to Bio Green (#22c55e)
      store.updateSelectedSvgColor("#22c55e", undefined);
      selected = store.getSelectedElement();
      assert.ok(selected);
      props = selected.properties as SvgProperties;
      assert.equal(props.fill, "#22c55e");
      assert.equal(props.stroke, "#ef4444");
      assert.ok((props.svgContent as string).includes('fill="#22c55e"'));

      // 4. Test Line extraction, line recoloring, and stroke width removal (strokeWidth = 0)
      const lineSvg = `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <line id="connector-line" x1="10" y1="10" x2="90" y2="90" stroke="#1d4ed8" stroke-width="2" />
          <circle id="node-circle" cx="50" cy="50" r="20" fill="#3b82f6" />
        </svg>
      `;
      const lineComponents = extractSvgSubComponents(lineSvg);
      assert.equal(lineComponents.length, 2);
      assert.equal(lineComponents[0]?.tag, "line");
      assert.equal(lineComponents[0]?.stroke, "#1d4ed8");

      // Recolor line with Bio Red Line (#b91c1c)
      const recoloredLine = modifySvgComponentColor(lineSvg, "connector-line", {
        stroke: "#b91c1c",
        strokeWidth: 4,
      });
      assert.ok(recoloredLine.includes('stroke="#b91c1c"'));
      assert.ok(recoloredLine.includes('stroke-width="4"'));

      // Remove outline/line (strokeWidth: 0 or stroke: "none")
      store.updateSelectedSvgColor(undefined, "none", 0);
      selected = store.getSelectedElement();
      assert.ok(selected);
      props = selected.properties as SvgProperties & { strokeWidth?: number };
      assert.equal(props.stroke, "none");
      assert.equal(props.strokeWidth, 0);
    });

    it("should support async distribution when SVG content is initially a remote URL", async () => {
      const doc: DesignDocument = {
        id: "doc-async-distribute",
        name: "Remote Viral Vector",
        width: 1000,
        height: 1000,
        backgroundColor: "#ffffff",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: [{ id: "page-1", name: "Page 1", elements: [] }],
      };

      const store = new EditorStore(doc);
      const remoteElement = {
        id: "elem-remote-virion",
        type: "svg" as const,
        name: "SARS CoV 2 Virion",
        x: 150,
        y: 150,
        width: 400,
        height: 400,
        rotation: 0,
        opacity: 1,
        properties: {
          svgContent: "https://r2.medicalcanva.com/assets/species/sars-cov-2.svg",
          originalSvg: "https://r2.medicalcanva.com/assets/species/sars-cov-2.svg",
        },
      };

      store.addElement(remoteElement);
      store.selectElement(remoteElement.id);

      // Pre-resolve markup into cache or simulate resolution
      const rawVirionXml = `
        <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
          <g id="outer-spikes" fill="#f97316" stroke="#c2410c">
            <path d="M 50 50 L 80 80" />
          </g>
          <circle id="lipid-envelope" cx="200" cy="200" r="140" fill="#fed7aa" stroke="#ea580c" />
          <g id="nucleocapsid-core" fill="#22c55e" stroke="#15803d">
            <circle cx="200" cy="200" r="80" />
          </g>
        </svg>
      `;
      store.resolveAssetSvgMarkup(remoteElement.id, rawVirionXml);

      const distributed = await store.distributeSelectedSvgComponentsAsync();
      assert.ok(distributed);
      assert.equal(distributed.length, 3);

      const activePage = store.getActivePage();
      assert.ok(activePage);
      assert.equal(activePage.elements.length, 3);
      assert.equal(activePage.elements[0]?.name, "SARS CoV 2 Virion — Outer Spikes");
      assert.equal(activePage.elements[2]?.name, "SARS CoV 2 Virion — Nucleocapsid Core");
    });

    it("should enter BioRender Group Edit mode, allow dragging/recoloring subcomponents, and exit group cleanly", async () => {
      const doc: DesignDocument = {
        id: "doc-group-edit-session",
        name: "BioRender Virion Group Edit",
        width: 1000,
        height: 1000,
        backgroundColor: "#ffffff",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: [{ id: "page-1", name: "Page 1", elements: [] }],
      };

      const store = new EditorStore(doc);
      const virionElement = {
        id: "elem-virion-main",
        type: "svg" as const,
        name: "SARS CoV 2 Virion",
        x: 100,
        y: 100,
        width: 400,
        height: 400,
        rotation: 0,
        opacity: 1,
        properties: {
          svgContent: `
            <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
              <g id="envelope" fill="#fed7aa" stroke="#ea580c"><circle cx="200" cy="200" r="140" /></g>
              <g id="nucleocapsid" fill="#22c55e" stroke="#15803d"><circle cx="200" cy="200" r="60" /></g>
            </svg>
          `,
          originalSvg: `
            <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
              <g id="envelope" fill="#fed7aa" stroke="#ea580c"><circle cx="200" cy="200" r="140" /></g>
              <g id="nucleocapsid" fill="#22c55e" stroke="#15803d"><circle cx="200" cy="200" r="60" /></g>
            </svg>
          `,
        },
      };

      store.addElement(virionElement);

      // 1. Enter Group Edit mode: navigation only, the illustration stays one element
      const entered = await store.enterGroupEdit(virionElement.id);
      assert.equal(entered, true);
      const session = store.getGroupEditSession();
      assert.ok(session);
      assert.equal(session.groupName, "SARS CoV 2 Virion");
      assert.equal(store.getActivePage().elements.length, 1);

      // The 2 subcomponents are addressable layers
      const layers = store.getLayerGeoms(virionElement.id, []);
      assert.equal(layers.length, 2);
      const nucleoIndex = layers.findIndex((l) => l.name.toLowerCase().includes("nucleocapsid"));
      assert.ok(nucleoIndex >= 0);

      // 2. Select and drag the nucleocapsid core away from the envelope
      store.setLayerNav(virionElement.id, [], [nucleoIndex]);
      assert.equal(store.getGroupEditSession()?.selectedLayerName?.toLowerCase().includes("nucleocapsid"), true);
      store.transformSelectedLayer([1, 0, 0, 1, 100, 0]);

      // 3. Recolor only the nucleocapsid with Bio Red fill and Bio Red Line stroke
      store.updateSelectedSvgColor("#ef4444", "#b91c1c", 3);

      // 4. Exit Group Edit mode
      store.exitAllGroupEdits();
      assert.equal(store.getGroupEditSession(), null);

      const activePage = store.getActivePage();
      assert.equal(activePage.elements.length, 1);
      assert.equal(activePage.elements[0]?.name, "SARS CoV 2 Virion");
      const finalSvg = (activePage.elements[0]?.properties as SvgProperties).svgContent;
      assert.ok(finalSvg.includes("fill:#ef4444"));
      assert.ok(finalSvg.includes("stroke:#b91c1c"));
      // 100px on a 400px element showing a 400-unit viewBox = 100 units
      assert.ok(/<g id="nucleocapsid"[^>]*transform="translate\(100 0\)"/.test(finalSvg));
      // The envelope is untouched
      assert.ok(finalSvg.includes('<g id="envelope" fill="#fed7aa" stroke="#ea580c">'));
    });

    it("should allow multi-element grouping (Figma/BioRender Group) with undo/redo", () => {
      const doc: DesignDocument = {
        id: "doc-multigroup",
        name: "Multi Group",
        width: 1000,
        height: 1000,
        backgroundColor: "#ffffff",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: [{ id: "page-1", name: "Page 1", elements: [] }],
      };

      const store = new EditorStore(doc);
      const el1 = {
        id: "shape-1",
        type: "svg" as const,
        name: "Antigen Spike",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        rotation: 0,
        opacity: 1,
        properties: { svgContent: `<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="#3b82f6" /></svg>` },
      };
      const el2 = {
        id: "shape-2",
        type: "svg" as const,
        name: "Antibody Fab",
        x: 200,
        y: 100,
        width: 50,
        height: 50,
        rotation: 0,
        opacity: 1,
        properties: { svgContent: `<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="#ef4444" /></svg>` },
      };

      store.addElement(el1);
      store.addElement(el2);
      assert.equal(store.getActivePage()?.elements.length, 2);

      // Group elements
      const group = store.groupElements(["shape-1", "shape-2"]);
      assert.ok(group);
      assert.equal(store.getActivePage()?.elements.length, 1);
      assert.equal(store.getActivePage()?.elements[0]?.id, group.id);

      // Undo
      store.undo();
      assert.equal(store.getActivePage()?.elements.length, 2);

      // Redo
      store.redo();
      assert.equal(store.getActivePage()?.elements.length, 1);
    });
  });
});
