import { NextRequest, NextResponse } from "next/server";
import { SupabaseAssetRepository } from "@design-platform/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const categorySlug = searchParams.get("categorySlug") || category;
    const subcategory = searchParams.get("subcategory") || undefined;
    const subcategorySlug = searchParams.get("subcategorySlug") || subcategory;
    const search = searchParams.get("search") || undefined;

    const repo = new SupabaseAssetRepository();
    // Customer API: Strictly filter to published assets
    const assets = await repo.list({
      category,
      categorySlug,
      subcategory,
      subcategorySlug,
      search,
      status: "published",
      // The library shows R2 files; markup is fetched when an asset is used
      withSvgContent: false,
    });
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
