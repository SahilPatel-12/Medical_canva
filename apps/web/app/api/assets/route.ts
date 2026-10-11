import { NextRequest, NextResponse } from "next/server";
import { SupabaseAssetRepository } from "@design-platform/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const subcategory = searchParams.get("subcategory") || undefined;
    const search = searchParams.get("search") || undefined;

    const repo = new SupabaseAssetRepository();
    const assets = await repo.list({ category, subcategory, search });
    const categories = await repo.getCategories();

    return NextResponse.json({
      success: true,
      data: assets,
      categories,
    });
  } catch (error) {
    console.error("[GET /api/assets web error]:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
