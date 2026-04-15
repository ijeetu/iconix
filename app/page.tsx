import { IconixBrowser } from "@/components/iconix-browser";
import type { SlimIconRecord } from "@/lib/icon-types";
import rawManifest from "@/generated/icon-manifest.json";

export default function HomePage() {
  // Strip server-only file paths before sending to the client component.
  // This eliminates the /api/manifest fetch and loading state entirely.
  const icons: SlimIconRecord[] = rawManifest.map(
    ({ slug, category, style, index, label, componentName }) => ({
      slug,
      category,
      style,
      index,
      label,
      componentName,
    }),
  );

  return <IconixBrowser initialIcons={icons} />;
}
