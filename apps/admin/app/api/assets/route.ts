import { NextRequest, NextResponse } from "next/server";
import { getR2StorageDriver } from "@design-platform/storage";
import { SupabaseAssetRepository } from "@design-platform/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;

    const repo = new SupabaseAssetRepository();
    const assets = await repo.list({ category, search });
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
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided for upload" },
        { status: 400 }
      );
    }

    const rawName = formData.get("name") as string | null;
    const category = (formData.get("category") as string) || "science";
    const categorySlug = (formData.get("categorySlug") as string) || undefined;
    const subcategorySlug = (formData.get("subcategorySlug") as string) || undefined;
    const subcategoryId = (formData.get("subcategoryId") as string) || undefined;
    const subcategoryName = (formData.get("subcategoryName") as string) || undefined;
    const rawTags = (formData.get("tags") as string) || "";
    const customWidth = parseInt((formData.get("width") as string) || "120", 10);
    const customHeight = parseInt((formData.get("height") as string) || "120", 10);

    const fileName = file.name || "asset";
    const displayName =
      rawName?.trim() ||
      fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const contentType = file.type || "application/octet-stream";
    const isSvg = contentType.includes("svg") || fileName.endsWith(".svg");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let svgContent: string | null = null;
    if (isSvg) {
      svgContent = buffer.toString("utf-8");
    }

    // Determine element type
    const assetType = isSvg ? "svg" : "image";

    // Build unique R2 key
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const r2Key = `assets/${categorySlug || category}/${Date.now()}-${sanitizedFileName}`;

    // 1. Upload to Cloudflare R2
    const storageDriver = getR2StorageDriver();
    const uploadResult = await storageDriver.uploadFile(r2Key, buffer, contentType);

    // 2. Parse tags
    const tags = rawTags
      ? rawTags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [category.toLowerCase()];

    if (categorySlug && !tags.includes(categorySlug)) tags.push(categorySlug);
    if (subcategorySlug && !tags.includes(subcategorySlug)) tags.push(subcategorySlug);
    if (categorySlug) tags.push(`cat:${categorySlug}`);
    if (subcategorySlug) tags.push(`subcat:${subcategorySlug}`);

    // 3. Save metadata into Supabase
    const repo = new SupabaseAssetRepository();
    const createdAsset = await repo.create({
      id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: displayName,
      category,
      category_slug: categorySlug,
      subcategory_id: subcategoryId,
      subcategory_slug: subcategorySlug,
      subcategory_name: subcategoryName,
      type: assetType,
      r2_key: r2Key,
      public_url: uploadResult.publicUrl || storageDriver.getPublicUrl(r2Key),
      content_type: contentType,
      size_bytes: buffer.byteLength,
      width: customWidth,
      height: customHeight,
      tags,
      svg_content: svgContent,
      thumbnail_url: uploadResult.publicUrl || storageDriver.getPublicUrl(r2Key),
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
