import { NextRequest, NextResponse } from "next/server";
import { getR2StorageDriver } from "@design-platform/storage";
import { SupabaseAssetRepository } from "@design-platform/database";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing asset ID" }, { status: 400 });
    }

    const repo = new SupabaseAssetRepository();
    // Delete from Supabase and retrieve existing record
    const deletedRow = await repo.delete(id);

    // If existing row has an R2 key, delete from Cloudflare R2 bucket
    if (deletedRow?.r2_key) {
      try {
        const storageDriver = getR2StorageDriver();
        await storageDriver.deleteFile(deletedRow.r2_key);
        console.log(`[R2] Deleted asset ${deletedRow.r2_key} from Cloudflare R2`);
      } catch (r2Error) {
        console.warn(
          `[R2 Warning] Could not delete ${deletedRow.r2_key} from R2:`,
          (r2Error as Error)?.message || "Unknown storage error"
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Asset ${id} successfully deleted from Cloudflare R2 and Supabase.`,
    });
  } catch (error) {
    console.error("[DELETE /api/assets/[id] error]:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
