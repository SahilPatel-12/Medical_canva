import { NextRequest, NextResponse } from "next/server";
import { getR2StorageDriver } from "@design-platform/storage";
import { SupabaseAssetRepository } from "@design-platform/database";
import { verifyAdminAuth } from "@design-platform/auth";
import {
  validateFileSignatureAndFormat,
  buildAssetStoragePath,
} from "../validation";

export const dynamic = "force-dynamic";

/**
 * PUT: Replace asset file and metadata while preserving the stable asset ID.
 * Increments version and uploads validated new file before updating database.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(request.headers);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Administrative authorization required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing asset ID" }, { status: 400 });
    }

    const repo = new SupabaseAssetRepository();
    const existing = await repo.getById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Asset with ID '${id}' not found` },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: "Replacement file is required" },
        { status: 400 }
      );
    }

    // 1. Validate file signature, format, and sanitize SVG
    const arrayBuffer = await file.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const fileName = file.name || "replacement-asset";

    const validation = validateFileSignatureAndFormat(rawBuffer, fileName, file.type);
    if (!validation.valid || !validation.sanitizedBuffer) {
      return NextResponse.json(
        { success: false, error: validation.error || "Replacement file validation failed" },
        { status: 400 }
      );
    }

    // 2. Compute new version and safe R2 path
    const nextVersion = (existing.version || 1) + 1;
    const catSlug = existing.categorySlug || existing.category || "science";
    const subcatId = existing.subcategorySlug || existing.subcategoryId || "general";

    const { r2Key } = buildAssetStoragePath(
      catSlug,
      subcatId,
      id,
      fileName,
      nextVersion
    );

    // 3. Upload to Cloudflare R2 first.
    // If upload fails, abort immediately so current asset remains intact.
    const storageDriver = getR2StorageDriver();
    const uploadResult = await storageDriver.uploadFile(
      r2Key,
      validation.sanitizedBuffer,
      validation.mimeType || "application/octet-stream"
    );

    const publicUrl = uploadResult.publicUrl || storageDriver.getPublicUrl(r2Key);
    const newName = (formData.get("name") as string)?.trim() || existing.name;

    // 4. Update Supabase record with version increment
    const updated = await repo.replace(id, {
      r2Key,
      publicUrl,
      contentType: validation.mimeType,
      sizeBytes: validation.sanitizedBuffer.byteLength,
      contentHash: validation.contentHash,
      svgContent: validation.svgContent,
      name: newName,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Asset '${id}' successfully replaced with version ${nextVersion}.`,
    });
  } catch (error) {
    console.error("[PUT /api/assets/[id] error]:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update asset lifecycle status (published, draft, archived) or taxonomy metadata.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(request.headers);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Administrative authorization required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing asset ID" }, { status: 400 });
    }

    const repo = new SupabaseAssetRepository();
    const existing = await repo.getById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Asset with ID '${id}' not found` },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.status) {
      if (!["published", "draft", "archived"].includes(body.status)) {
        return NextResponse.json(
          { success: false, error: "Invalid status. Allowed values: published, draft, archived" },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }

    if (body.name && typeof body.name === "string") {
      updates.name = body.name.trim();
    }

    if (Array.isArray(body.tags)) {
      updates.tags = body.tags;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();
    const updatedAsset = await repo.update(id, updates);

    return NextResponse.json({
      success: true,
      data: updatedAsset,
      message: `Asset '${id}' successfully updated.`,
    });
  } catch (error) {
    console.error("[PATCH /api/assets/[id] error]:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete asset with design-reference protection and safe R2 cleanup order.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(request.headers);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Administrative authorization required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing asset ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    const repo = new SupabaseAssetRepository();
    const existing = await repo.getById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Asset with ID '${id}' not found` },
        { status: 404 }
      );
    }

    // 1. Check if active designs reference this asset
    if (!force) {
      const designRef = await repo.isAssetReferencedInDesigns(id, existing.url);
      if (designRef.referenced) {
        return NextResponse.json(
          {
            success: false,
            referenced: true,
            designCount: designRef.designCount,
            designNames: designRef.designNames,
            message: `Asset is referenced by ${designRef.designCount} active design(s) (${designRef.designNames.join(", ")}). Archiving is recommended to preserve existing canvases. Use ?force=true to override.`,
          },
          { status: 409 }
        );
      }
    }

    // 2. Safe Deletion Order: Delete R2 binary object first
    if (existing.r2Key) {
      try {
        const storageDriver = getR2StorageDriver();
        await storageDriver.deleteFile(existing.r2Key);
        console.log(`[R2 Cleanup] Deleted R2 object ${existing.r2Key}`);
      } catch (r2Error) {
        console.error(`[R2 Cleanup Error] Failed to delete object ${existing.r2Key}:`, r2Error);
        // Do NOT delete the database record if storage deletion failed,
        // so administrators have full visibility to retry or reconcile.
        return NextResponse.json(
          {
            success: false,
            error: `Failed to remove object from Cloudflare R2: ${(r2Error as Error).message}. Database record was preserved.`,
            r2Key: existing.r2Key,
          },
          { status: 502 }
        );
      }
    }

    // 3. Delete metadata row in Supabase only after R2 confirmed deleted
    await repo.delete(id);

    return NextResponse.json({
      success: true,
      message: `Asset '${id}' successfully removed from Cloudflare R2 and Supabase.`,
    });
  } catch (error) {
    console.error("[DELETE /api/assets/[id] error]:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
