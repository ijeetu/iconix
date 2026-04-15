const SVG_TAG_PATTERN = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/i;
const VIEW_BOX_PATTERN = /viewBox="([^"]+)"/i;
const WIDTH_PATTERN = /width="([^"]+)"/i;
const HEIGHT_PATTERN = /height="([^"]+)"/i;

function deriveViewBox(svgAttributes: string) {
  const viewBox = svgAttributes.match(VIEW_BOX_PATTERN)?.[1];

  if (viewBox) {
    return viewBox;
  }

  const width = svgAttributes.match(WIDTH_PATTERN)?.[1] ?? "24";
  const height = svgAttributes.match(HEIGHT_PATTERN)?.[1] ?? "24";

  return `0 0 ${width} ${height}`;
}

export function normalizeSvgBody(body: string) {
  return body
    .replace(/\s+xmlns(:xlink)?="[^"]*"/g, "")
    .replace(/(fill|stroke)="(?!none\b)[^"]*"/gi, '$1="currentColor"')
    .trim();
}

export function extractNormalizedSvgParts(svg: string) {
  const match = svg.match(SVG_TAG_PATTERN);

  if (!match) {
    throw new Error("Invalid SVG file");
  }

  const [, svgAttributes, body] = match;

  return {
    viewBox: deriveViewBox(svgAttributes),
    body: normalizeSvgBody(body),
  };
}

export function buildDownloadableSvg(svg: string) {
  const { viewBox, body } = extractNormalizedSvgParts(svg);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">${body}</svg>`;
}
