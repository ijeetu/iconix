import { readFile } from "node:fs/promises";
import path from "node:path";
import manifest from "@/generated/icon-manifest.json";
import { buildDownloadableSvg } from "@/lib/icon-normalize";

const manifestMap = new Map(manifest.map((icon) => [icon.slug, icon]));

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const shouldDownload = url.searchParams.get("download") === "1";
    const icon = manifestMap.get(slug);

    if (!icon) {
      return new Response("Icon not found", { status: 404 });
    }

    if (format === "component") {
      const componentFile = path.join(process.cwd(), icon.componentPath);
      const componentSource = await readFile(componentFile, "utf8");

      return new Response(componentSource, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }

    const svgFile = path.join(process.cwd(), icon.filePath);
    const originalSvg = await readFile(svgFile, "utf8");
    const svg = buildDownloadableSvg(originalSvg);

    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        ...(shouldDownload
          ? {
              "content-disposition": `attachment; filename="${icon.slug}.svg"`,
            }
          : {}),
      },
    });
  } catch (error) {
    console.error("Icon route failed:", error);
    return new Response("Failed to load icon", { status: 500 });
  }
}
