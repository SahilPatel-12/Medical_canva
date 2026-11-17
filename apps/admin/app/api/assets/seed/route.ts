import { NextRequest, NextResponse } from "next/server";
import { getR2StorageDriver } from "@design-platform/storage";
import { SupabaseAssetRepository } from "@design-platform/database";
import { SAMPLE_ASSETS } from "@design-platform/editor";
import { verifyAdminAuth } from "@design-platform/auth";
import { buildAssetStoragePath } from "../validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Server-Side Administrative Authorization
    const authResult = await verifyAdminAuth(request.headers);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Administrative authorization required to seed assets" },
        { status: 401 }
      );
    }

    const storageDriver = getR2StorageDriver();
    const repo = new SupabaseAssetRepository();
    const uploaded = [];

    for (const sample of SAMPLE_ASSETS) {
      // Determine file extension and content
      const isSvg = sample.type === "svg" || sample.source.startsWith("<svg");
      const ext = isSvg ? "svg" : "json";
      const sanitizedName = sample.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      // Same layout as admin uploads: platform-assets/{category}/{subcategory}/{asset}/{file}
      const r2Key = buildAssetStoragePath(
        sample.categorySlug || sample.category.toLowerCase().replace(/\s+/g, "-"),
        sample.subcategorySlug || "general",
        sample.id,
        `${sanitizedName}.${ext}`
      ).r2Key;
      const contentType = isSvg ? "image/svg+xml" : "application/json";

      // Upload SVG to Cloudflare R2
      const uploadRes = await storageDriver.uploadFile(
        r2Key,
        Buffer.from(sample.source, "utf-8"),
        contentType
      );

      // Check if already in Supabase
      const existing = await repo.getById(sample.id);
      if (!existing) {
        await repo.create({
          id: sample.id,
          name: sample.name,
          category: sample.category,
          category_slug: sample.categorySlug || sample.category.toLowerCase().replace(/\s+/g, "-"),
          subcategory_id: sample.subcategoryId,
          subcategory_slug: sample.subcategorySlug,
          subcategory_name: sample.subcategoryName,
          type: sample.type,
          r2_key: r2Key,
          public_url: uploadRes.publicUrl || storageDriver.getPublicUrl(r2Key),
          content_type: contentType,
          size_bytes: uploadRes.sizeBytes,
          width: sample.defaultWidth || 120,
          height: sample.defaultHeight || 120,
          tags: sample.tags || [],
          svg_content: isSvg ? sample.source : null,
          thumbnail_url: uploadRes.publicUrl || storageDriver.getPublicUrl(r2Key),
          status: "published",
          version: 1,
          created_by: authResult.userId,
        });
      }

      uploaded.push({
        id: sample.id,
        name: sample.name,
        r2Key,
        publicUrl: uploadRes.publicUrl || storageDriver.getPublicUrl(r2Key),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${uploaded.length} built-in medical icons to Cloudflare R2 and Supabase!`,
      data: uploaded,
    });
  } catch (error) {
    console.error("[POST /api/assets/seed error]:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
