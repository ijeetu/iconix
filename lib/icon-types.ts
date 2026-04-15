export type IconRecord = {
  slug: string;
  category: string;
  style: string;
  index: number;
  label: string;
  componentName: string;
  filePath: string;
  componentPath: string;
};

// Client-safe subset — no server-only file paths
export type SlimIconRecord = Omit<IconRecord, "filePath" | "componentPath">;
