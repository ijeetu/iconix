"use client";

import type { CSSProperties } from "react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { IconRecord } from "@/lib/icon-types";

const DENSITY_PRESETS = [
  { id: "compact", label: "Compact", cardMin: 140, iconSize: 38 },
  { id: "balanced", label: "Balanced", cardMin: 160, iconSize: 48 },
  { id: "showcase", label: "Large", cardMin: 188, iconSize: 60 },
] as const;

type DensityPreset = (typeof DENSITY_PRESETS)[number]["id"];

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function categoryId(categoryName: string) {
  return `category-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function IconixBrowser() {
  const [icons, setIcons] = useState<IconRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState("All");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [density, setDensity] = useState<DensityPreset>("balanced");
  const [previewScale, setPreviewScale] = useState(48);
  const [activeCategoryNav, setActiveCategoryNav] = useState("overview");
  const cacheRef = useRef(new Map<string, string>());
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let active = true;

    fetch("/api/manifest")
      .then((response) => response.json())
      .then((data: IconRecord[]) => {
        if (active) {
          setIcons(data);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!status) {
      return;
    }

    const timeout = window.setTimeout(() => setStatus(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    setActiveCategoryNav("overview");
  }, [deferredQuery, style]);

  const categoryCountMap = new Map<string, number>();
  const styleCountMap = new Map<string, number>();

  for (const icon of icons) {
    categoryCountMap.set(icon.category, (categoryCountMap.get(icon.category) ?? 0) + 1);
    styleCountMap.set(icon.style, (styleCountMap.get(icon.style) ?? 0) + 1);
  }

  const categoryEntries = [...categoryCountMap.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return left[0].localeCompare(right[0]);
  });
  const styles = ["All", ...[...styleCountMap.keys()].sort((left, right) => left.localeCompare(right))];
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredIcons = icons.filter((icon) => {
    if (style !== "All" && icon.style !== style) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      icon.slug,
      icon.label,
      icon.category,
      icon.style,
      icon.componentName,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  const filteredCategoryCountMap = new Map<string, number>();
  for (const icon of filteredIcons) {
    filteredCategoryCountMap.set(
      icon.category,
      (filteredCategoryCountMap.get(icon.category) ?? 0) + 1,
    );
  }

  const groupedIcons = categoryEntries
    .map(([categoryName, totalCount]) => ({
      category: categoryName,
      totalCount,
      visibleCount: filteredCategoryCountMap.get(categoryName) ?? 0,
      items: filteredIcons.filter((icon) => icon.category === categoryName),
    }))
    .filter((group) => group.items.length > 0);

  const selectedIcon = selectedSlug
    ? icons.find((icon) => icon.slug === selectedSlug) ?? null
    : null;
  const densityPreset =
    DENSITY_PRESETS.find((preset) => preset.id === density) ?? DENSITY_PRESETS[1];
  const visibleCategoryCount = groupedIcons.length;
  const hasFilters = Boolean(normalizedQuery) || style !== "All";
  const filterSummary = normalizedQuery
    ? `Results for "${deferredQuery.trim()}"`
    : style === "All"
      ? "Jump between icon families"
      : `${style} style only`;

  const scrollToCategory = (categoryName: string) => {
    const targetId = categoryName === "overview" ? "icon-explorer-top" : categoryId(categoryName);
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    setActiveCategoryNav(categoryName);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const fetchText = async (url: string) => {
    if (cacheRef.current.has(url)) {
      return cacheRef.current.get(url)!;
    }

    const response = await fetch(url);
    const text = await response.text();
    cacheRef.current.set(url, text);
    return text;
  };

  const copyText = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setStatus(`${label} copied`);
  };

  const copySvg = async () => {
    if (!selectedIcon) {
      return;
    }

    const svg = await fetchText(`/api/icons/${selectedIcon.slug}`);
    await copyText("SVG", svg);
  };

  const copyComponent = async () => {
    if (!selectedIcon) {
      return;
    }

    const component = await fetchText(
      `/api/icons/${selectedIcon.slug}?format=component`,
    );
    await copyText("React component", component);
  };

  const downloadSvg = () => {
    if (!selectedIcon) {
      return;
    }

    const link = document.createElement("a");
    link.href = `/api/icons/${selectedIcon.slug}?download=1`;
    link.download = `${selectedIcon.slug}.svg`;
    document.body.append(link);
    link.click();
    link.remove();
  };

  const copyUsageSnippet = async () => {
    if (!selectedIcon) {
      return;
    }

    const snippet = [
      `import { ${selectedIcon.componentName} } from "@/generated/components/${selectedIcon.componentName}";`,
      "",
      `export default function Example() {`,
      `  return <${selectedIcon.componentName} size={24} color="currentColor" />;`,
      `}`,
    ].join("\n");

    await copyText("Usage snippet", snippet);
  };

  return (
    <main className="dashboard-shell simple-shell">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <img alt="Vishwa Labs" src="/vishwalabs-logo.svg" />
          </div>
          <div>
            <p className="sidebar-kicker">Icon Platform</p>
            <h1>Iconix</h1>
          </div>
        </div>

        <div className="sidebar-overview">
          <div className="sidebar-stat">
            <span>Visible</span>
            <strong>{formatCount(filteredIcons.length)}</strong>
          </div>
          <div className="sidebar-stat">
            <span>Groups</span>
            <strong>{formatCount(visibleCategoryCount)}</strong>
          </div>
          <div className="sidebar-stat">
            <span>Styles</span>
            <strong>{formatCount(styles.length - 1)}</strong>
          </div>
        </div>

        <section className="sidebar-block sidebar-category-block">
          <div className="sidebar-block-head">
            <div>
              <span>Categories</span>
              <p>{filterSummary}</p>
            </div>
            <strong>{formatCount(categoryEntries.length)}</strong>
          </div>
          <button
            className={`sidebar-item ${activeCategoryNav === "overview" ? "active" : ""}`}
            onClick={() => scrollToCategory("overview")}
            type="button"
          >
            <span className="sidebar-item-copy">
              <span className="sidebar-item-title">All icons</span>
              <span className="sidebar-item-meta">
                {hasFilters ? "Filtered selection" : "Full library overview"}
              </span>
            </span>
            <strong>{formatCount(filteredIcons.length)}</strong>
          </button>
          <div className="sidebar-list">
            {categoryEntries.map(([name, count]) => (
              <button
                key={name}
                className={`sidebar-item ${activeCategoryNav === name ? "active" : ""}`}
                disabled={!filteredCategoryCountMap.get(name)}
                onClick={() => scrollToCategory(name)}
                type="button"
              >
                <span className="sidebar-item-copy">
                  <span className="sidebar-item-title">{name}</span>
                  <span className="sidebar-item-meta">
                    {formatCount(filteredCategoryCountMap.get(name) ?? 0)} visible
                  </span>
                </span>
                <strong>
                  {formatCount(count)}
                </strong>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar simple-topbar">
          <div>
            <p className="dashboard-kicker">Library</p>
            <h2>Browse and copy icons</h2>
          </div>

          <div className="dashboard-topbar-actions">
            {status ? <span className="dashboard-status">{status}</span> : null}
            <button
              className="button-ghost"
              onClick={() => {
                setQuery("");
                setStyle("All");
                setActiveCategoryNav("overview");
              }}
              type="button"
            >
              Reset
            </button>
          </div>
        </header>

        <section
          className="panel explorer-panel simple-explorer"
          style={
            {
              "--icon-card-min": `${densityPreset.cardMin}px`,
              "--icon-preview-size": `${previewScale}px`,
            } as CSSProperties
          }
        >
          <div className="explorer-toolbar" id="icon-explorer-top">
            <input
              aria-label="Search icons"
              className="input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search icons"
              value={query}
            />

            <select
              aria-label="Filter by style"
              className="select"
              onChange={(event) => setStyle(event.target.value)}
              value={style}
            >
              {styles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              aria-label="Grid density"
              className="select"
              onChange={(event) => {
                const nextDensity = event.target.value as DensityPreset;
                const preset =
                  DENSITY_PRESETS.find((item) => item.id === nextDensity) ?? DENSITY_PRESETS[1];
                setDensity(nextDensity);
                setPreviewScale(preset.iconSize);
              }}
              value={density}
            >
              {DENSITY_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="compact-toolbar">
            <div className="compact-toolbar-meta">
              <span>{formatCount(filteredIcons.length)} icons</span>
              <span>{formatCount(groupedIcons.length)} groups</span>
            </div>
            <div className="compact-range">
              <label htmlFor="icon-size-range">Size</label>
              <input
                id="icon-size-range"
                aria-label="Adjust icon preview size"
                className="range-input"
                max="76"
                min="32"
                onChange={(event) => setPreviewScale(Number(event.target.value))}
                type="range"
                value={previewScale}
              />
            </div>
          </div>

          {loading ? (
            <div className="empty">
              <h3>Loading icons</h3>
              <p>Preparing the catalog.</p>
            </div>
          ) : groupedIcons.length === 0 ? (
            <div className="empty">
              <h3>No results</h3>
              <p>Try a broader search or another style.</p>
            </div>
          ) : (
            <div className="catalog-sections">
              {groupedIcons.map((group) => (
                <section
                  key={group.category}
                  className="category-section"
                  id={categoryId(group.category)}
                >
                  <div className="category-section-head">
                    <div>
                      <h4>{group.category}</h4>
                      <p>{formatCount(group.visibleCount)} icons</p>
                    </div>
                  </div>

                  <div className="icon-grid">
                    {group.items.map((icon) => (
                      <button
                        key={icon.slug}
                        className={`icon-card ${icon.slug === selectedIcon?.slug ? "active" : ""}`}
                        onClick={() => {
                          setSelectedSlug(icon.slug);
                          setIsActionOpen(true);
                        }}
                        type="button"
                      >
                        <div className="icon-card-preview">
                          <img alt={icon.label} loading="lazy" src={`/api/icons/${icon.slug}`} />
                        </div>
                        <div className="icon-card-copy">
                          <div className="icon-card-name">{icon.label}</div>
                          <div className="icon-card-meta">{icon.style}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </section>

      {isActionOpen && selectedIcon ? (
        <div
          className="action-sheet-backdrop"
          onClick={() => setIsActionOpen(false)}
          role="presentation"
        >
          <div
            className="action-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="action-sheet-head">
              <div className="action-sheet-preview">
                <img alt={selectedIcon.label} src={`/api/icons/${selectedIcon.slug}`} />
              </div>
              <div className="action-sheet-copy">
                <h3>{selectedIcon.label}</h3>
                <p>{selectedIcon.category} · {selectedIcon.style}</p>
              </div>
              <button
                className="button-ghost action-sheet-close"
                onClick={() => setIsActionOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="action-sheet-actions">
              <button className="button" onClick={copySvg} type="button">
                Copy SVG
              </button>
              <button className="button-ghost" onClick={downloadSvg} type="button">
                Download SVG
              </button>
              <button className="button-ghost" onClick={copyComponent} type="button">
                Copy React Component
              </button>
              <button className="button-ghost" onClick={copyUsageSnippet} type="button">
                Copy Usage Snippet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
