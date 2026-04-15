import manifest from "@/generated/icon-manifest.json";

export async function GET() {
  return Response.json(manifest, {
    headers: {
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
