import { NextRequest, NextResponse } from "next/server";
import { getR2StorageDriver } from "@design-platform/storage";
import { SupabaseAssetRepository } from "@design-platform/database";
import { verifyAdminAuth } from "@design-platform/auth";
import {
  validateFileSignatureAndFormat,
  validateCanonicalTaxonomy,
  buildAssetStoragePath,
} from "./validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const categorySlug = searchParams.get("categorySlug") || undefined;
    const subcategory = searchParams.get("subcategory") || undefined;
    const subcategorySlug = searchParams.get("subcategorySlug") || undefined;
    const search = searchParams.get("search") || undefined;
    const statusParam = searchParams.get("status") || "all";
    const status = (statusParam as "published" | "draft" | "archived" | "all");

    const repo = new SupabaseAssetRepository();
    const assets = await repo.list({
      category,
      categorySlug,
      subcategory,
      subcategorySlug,
      search,
      status,
    });
    const categories = await repo.getCategories();

    return NextResponse.json({
      success: true,
      data: assets,
      categories,
    });
  } catch (error) {
    console.error("[GET /api/assets error]:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Server-Side Administrative Authorization
    const authResult = await verifyAdminAuth(request.headers);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Administrative authorization required" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided for upload" },
        { status: 400 }
      );
    }

    // Read and buffer file content
    const arrayBuffer = await file.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const fileName = file.name || "asset";

    // 2. Validate File Signature, Size, and Sanitize SVG
    const validation = validateFileSignatureAndFormat(rawBuffer, fileName, file.type);
    if (!validation.valid || !validation.sanitizedBuffer) {
      return NextResponse.json(
        { success: false, error: validation.error || "File validation failed" },
        { status: 400 }
      );
    }

    // 3. Validate Canonical Taxonomy
    const rawCatSlug =
      (formData.get("categorySlug") as string) ||
      (formData.get("category") as string) ||
      "cell-types";
    const rawSubcat =
      (formData.get("subcategorySlug") as string) ||
      (formData.get("subcategoryId") as string) ||
      (formData.get("subcategory") as string);

    const taxResult = validateCanonicalTaxonomy(rawCatSlug, rawSubcat);
    if (!taxResult.valid) {
      return NextResponse.json(
        { success: false, error: taxResult.error },
        { status: 400 }
      );
    }

    // 4. Duplicate Content Hash Detection
    const repo = new SupabaseAssetRepository();
    const allowDuplicate = formData.get("allowDuplicate") === "true";

    if (validation.contentHash && !allowDuplicate) {
      const duplicateAsset = await repo.getByHash(validation.contentHash);
      if (duplicateAsset) {
        return NextResponse.json(
          {
            success: false,
            duplicate: true,
            message: `Duplicate asset detected: identical content already exists as '${duplicateAsset.name}' (ID: ${duplicateAsset.id}). Set allowDuplicate=true to proceed anyway.`,
            existingAsset: duplicateAsset,
          },
          { status: 409 }
        );
      }
    }

    // 5. Construct Stable Metadata and R2 Object Key
    const rawName = formData.get("name") as string | null;
    const displayName =
      rawName?.trim() ||
      fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const { r2Key } = buildAssetStoragePath(
      taxResult.categorySlug,
      taxResult.subcategorySlug,
      assetId,
      fileName,
      1
    );

    const customWidth = parseInt((formData.get("width") as string) || "120", 10);
    const customHeight = parseInt((formData.get("height") as string) || "120", 10);
    const statusInput = (formData.get("status") as string) || "published";
    const assetStatus = ["published", "draft", "archived"].includes(statusInput)
      ? (statusInput as "published" | "draft" | "archived")
      : "published";

    // 6. Upload Binary to Cloudflare R2
    const storageDriver = getR2StorageDriver();
    const uploadResult = await storageDriver.uploadFile(
      r2Key,
      validation.sanitizedBuffer,
      validation.mimeType || "application/octet-stream"
    );

    // 7. Parse & Build Taxonomy Tags
    const rawTags = (formData.get("tags") as string) || "";
    const tags = rawTags
      ? rawTags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [taxResult.categorySlug];

    if (!tags.includes(taxResult.categorySlug)) tags.push(taxResult.categorySlug);
    if (!tags.includes(taxResult.subcategorySlug)) tags.push(taxResult.subcategorySlug);
    tags.push(`cat:${taxResult.categorySlug}`);
    tags.push(`subcat:${taxResult.subcategorySlug}`);

    // 8. Persist Metadata into Supabase
    const createdAsset = await repo.create({
      id: assetId,
      name: displayName,
      category: taxResult.category,
      category_slug: taxResult.categorySlug,
      subcategory_id: taxResult.subcategoryId,
      subcategory_slug: taxResult.subcategorySlug,
      subcategory_name: taxResult.subcategoryName,
      type: validation.format === "svg" ? "svg" : "image",
      r2_key: r2Key,
      public_url: uploadResult.publicUrl || storageDriver.getPublicUrl(r2Key),
      content_type: validation.mimeType || "image/svg+xml",
      size_bytes: validation.sanitizedBuffer.byteLength,
      width: customWidth,
      height: customHeight,
      tags,
      svg_content: validation.svgContent ?? null,
      thumbnail_url: uploadResult.publicUrl || storageDriver.getPublicUrl(r2Key),
      status: assetStatus,
      content_hash: validation.contentHash,
      version: 1,
      created_by: authResult.userId,
    });

    return NextResponse.json({
      success: true,
      data: createdAsset,
      message: `Successfully uploaded ${displayName} to Cloudflare R2 and Supabase!`,
    });
  } catch (error) {
    console.error("[POST /api/assets error]:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
