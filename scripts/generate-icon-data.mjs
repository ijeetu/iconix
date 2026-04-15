import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const iconsRoot = path.join(projectRoot, "icons");
const generatedRoot = path.join(projectRoot, "generated");
const componentsRoot = path.join(generatedRoot, "components");
const CATEGORY_ALIASES = {
  Essentional: "Essential",
};

const SVG_TAG_PATTERN = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/i;
const VIEW_BOX_PATTERN = /viewBox="([^"]+)"/i;
const WIDTH_PATTERN = /width="([^"]+)"/i;
const HEIGHT_PATTERN = /height="([^"]+)"/i;

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toPascalCase(value) {
  return value
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function titleCase(value) {
  return value
    .replace(/&/g, " and ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getSvgParts(svg) {
  const match = svg.match(SVG_TAG_PATTERN);

  if (!match) {
    throw new Error("Invalid SVG");
  }

  const [, attributes, body] = match;
  const viewBox = attributes.match(VIEW_BOX_PATTERN)?.[1];
  const width = attributes.match(WIDTH_PATTERN)?.[1] ?? "24";
  const height = attributes.match(HEIGHT_PATTERN)?.[1] ?? "24";

  return {
    viewBox: viewBox ?? `0 0 ${width} ${height}`,
    body: body
      .replace(/\s+xmlns(:xlink)?="[^"]*"/g, "")
      .replace(/(fill|stroke)="(?!none\b)[^"]*"/gi, '$1="currentColor"')
      .trim(),
  };
}

function escapeTemplateLiteral(value) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function extractIds(body) {
  return [...new Set([...body.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]))];
}

function parseIndex(filename) {
  const baseName = filename.replace(/\.svg$/i, "");
  const match = baseName.match(/-(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function buildLabel(category, style, index) {
  const suffix = index === 0 ? "" : ` ${index}`;
  return `${titleCase(CATEGORY_ALIASES[category] ?? category)} ${titleCase(style)}${suffix}`;
}

function buildComponentSource(componentName, viewBox, body, ids) {
  const bodyValue = escapeTemplateLiteral(body);
  const idsValue = ids.length === 0 ? "[]" : `[${ids.map((id) => `"${id}"`).join(", ")}]`;

  return `import { forwardRef, useId } from "react";
import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

const BODY = \`${bodyValue}\`;
const IDS = ${idsValue};

function withUniqueIds(svgBody: string, prefix: string) {
  let nextBody = svgBody;

  for (const id of IDS) {
    const scopedId = \`\${prefix}-\${id}\`;
    nextBody = nextBody.replaceAll(\`id="\${id}"\`, \`id="\${scopedId}"\`);
    nextBody = nextBody.replaceAll(\`url(#\${id})\`, \`url(#\${scopedId})\`);
    nextBody = nextBody.replaceAll(\`href="#\${id}"\`, \`href="#\${scopedId}"\`);
    nextBody = nextBody.replaceAll(\`xlink:href="#\${id}"\`, \`xlink:href="#\${scopedId}"\`);
  }

  return nextBody;
}

export const ${componentName} = forwardRef<SVGSVGElement, IconProps>(function ${componentName}(
  { size = 24, color = "currentColor", ...props },
  ref,
) {
  const idPrefix = useId().replace(/:/g, "");

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="${viewBox}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      color={color}
      dangerouslySetInnerHTML={{ __html: withUniqueIds(BODY, idPrefix) }}
      {...props}
    />
  );
});

export default ${componentName};
`;
}

async function collectSvgFiles(currentDirectory) {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSvgFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".svg")) {
      files.push(fullPath);
    }
  }

  return files;
}

await mkdir(generatedRoot, { recursive: true });
await rm(componentsRoot, { recursive: true, force: true });
await mkdir(componentsRoot, { recursive: true });

const svgFiles = await collectSvgFiles(iconsRoot);
const manifest = [];
const seenEntries = new Map();

for (const svgFile of svgFiles.sort((left, right) => left.localeCompare(right))) {
  const relativePath = path.relative(projectRoot, svgFile).replaceAll(path.sep, "/");
  const [, category, style, filename] = relativePath.split("/");
  const index = parseIndex(filename);
  const svg = await readFile(svgFile, "utf8");
  const { viewBox, body } = getSvgParts(svg);
  const categorySlug = slugify(category);
  const styleSlug = slugify(style);
  const baseSlug = `${categorySlug}-${styleSlug}${index === 0 ? "" : `-${index}`}`;
  const baseComponentName = `${toPascalCase(category)}${toPascalCase(style)}${index === 0 ? "" : index}`;
  const label = buildLabel(category, style, index);
  const signature = `${viewBox}__${body}`;

  if (seenEntries.has(baseSlug)) {
    const existingEntry = seenEntries.get(baseSlug);

    if (existingEntry.signature === signature) {
      continue;
    }
  }

  let slug = baseSlug;
  let componentName = baseComponentName;
  let collisionIndex = 2;

  while (seenEntries.has(slug)) {
    slug = `${baseSlug}-alt-${collisionIndex}`;
    componentName = `${baseComponentName}Alt${collisionIndex}`;
    collisionIndex += 1;
  }

  const ids = extractIds(body);
  const componentSource = buildComponentSource(componentName, viewBox, body, ids);
  const componentPath = `generated/components/${componentName}.tsx`;

  await writeFile(path.join(projectRoot, componentPath), componentSource, "utf8");

  const entry = {
    slug,
    category: CATEGORY_ALIASES[category] ?? category,
    style,
    index,
    label,
    componentName,
    filePath: relativePath,
    componentPath,
  };

  seenEntries.set(slug, { signature, entry });
  manifest.push(entry);
}

await writeFile(
  path.join(generatedRoot, "icon-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);
