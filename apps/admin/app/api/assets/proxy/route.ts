import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isForbiddenHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "169.254.169.254" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new NextResponse("Invalid URL parameter", { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new NextResponse("Forbidden URL protocol", { status: 400 });
  }

  if (isForbiddenHost(parsed.hostname)) {
    return new NextResponse("Access to internal host is forbidden", { status: 403 });
  }

  try {
    const res = await fetch(parsed.toString());
    if (!res.ok) {
      return new NextResponse("Remote asset fetch failed", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[Proxy Error]:", (error as Error)?.message || error);
    return new NextResponse("Failed to proxy requested asset", { status: 500 });
  }
}
