import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "identity",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Icy-Metadata": "1",
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Origin, Content-Type, Accept, Icy-Metadata",
    "Access-Control-Expose-Headers":
      "Icy-MetaInt,Icy-Br,Icy-Description,Icy-Genre,Icy-Name,Ice-Audio-Info,Icy-Url",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request) {
  const streamUrl = request.nextUrl.searchParams.get("url");
  if (!streamUrl) {
    return new NextResponse("URL parameter is required", { status: 400 });
  }

  let target;
  try {
    target = new URL(streamUrl);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new NextResponse("Invalid protocol", { status: 400 });
  }

  const upstream = await fetch(target.toString(), {
    method: "GET",
    headers: {
      ...UPSTREAM_HEADERS,
      Referer: `${target.origin}/`,
      Origin: target.origin,
    },
    redirect: "follow",
  });

  const headers = new Headers(upstream.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
