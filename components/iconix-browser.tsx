"use client";

import type { CSSProperties } from "react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { IconRecord } from "@/lib/icon-types";

const DENSITY_PRESETS = [
  { id: "compact", label: "Compact", cardMin: 140, iconSize: 38 },
  { id: "balanced", label: "Balanced", cardMin: 160, iconSize: 48 },
  { id: "showcase", label: "Large", cardMin: 188, iconSize: 60 },
] as const;
const THEME_STORAGE_KEY = "iconix-theme";
const THEME_DEFAULT_COLORS = {
  dark: "#ffffff",
  light: "#1f2228",
} as const;

type DensityPreset = (typeof DENSITY_PRESETS)[number]["id"];
type ThemeMode = keyof typeof THEME_DEFAULT_COLORS;

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function categoryId(categoryName: string) {
  return `category-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function IconixBrowser() {
  const [icons, setIcons] = useState<IconRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState("All");
  const [customColor, setCustomColor] = useState<string>(THEME_DEFAULT_COLORS.dark);
  const [isCustomColorDirty, setIsCustomColorDirty] = useState(false);
  const [customStrokeWidth, setCustomStrokeWidth] = useState(2);
  const [customSize, setCustomSize] = useState(24);
  const [absoluteStrokeWidth, setAbsoluteStrokeWidth] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [density, setDensity] = useState<DensityPreset>("balanced");
  const [previewScale, setPreviewScale] = useState(48);
  const [activeCategoryNav, setActiveCategoryNav] = useState("overview");
  const cacheRef = useRef(new Map<string, string>());
  const searchRef = useRef<HTMLInputElement>(null);
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
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
      return;
    }

    setTheme(
      window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
    );
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!isCustomColorDirty) {
      setCustomColor(THEME_DEFAULT_COLORS[theme]);
    }
  }, [isCustomColorDirty, theme]);

  useEffect(() => {
    if (!status) {
      return;
    }

    const timeout = window.setTimeout(() => setStatus(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isActionOpen) {
          setIsActionOpen(false);
          return;
        }
        if (query) {
          setQuery("");
          return;
        }
      }
      if (event.key === "/" && !isActionOpen) {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActionOpen, query]);

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
  const resolvedCustomizerColor = /^#([0-9a-f]{6})$/i.test(customColor)
    ? customColor
    : THEME_DEFAULT_COLORS[theme];

  useEffect(() => {
    if (loading || groupedIcons.length === 0) {
      return;
    }

    let frameId = 0;

    const syncActiveCategory = () => {
      const overviewTarget = document.getElementById("icon-explorer-top");
      const activationOffset = 140;

      if (!overviewTarget) {
        return;
      }

      if (overviewTarget.getBoundingClientRect().top > activationOffset) {
        setActiveCategoryNav((current) => (current === "overview" ? current : "overview"));
        return;
      }

      let nextActiveCategory = "overview";

      for (const group of groupedIcons) {
        const section = document.getElementById(categoryId(group.category));

        if (!section) {
          continue;
        }

        if (section.getBoundingClientRect().top <= activationOffset) {
          nextActiveCategory = group.category;
          continue;
        }

        break;
      }

      setActiveCategoryNav((current) => (
        current === nextActiveCategory ? current : nextActiveCategory
      ));
    };

    const handleScroll = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(syncActiveCategory);
    };

    syncActiveCategory();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [groupedIcons, loading]);

  const iconSrc = (slug: string) =>
    `/api/icons/${slug}?color=${encodeURIComponent(resolvedCustomizerColor)}&strokeWidth=${customStrokeWidth}`;

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

    const iconProps = [
      `size={${customSize}}`,
      `color="${resolvedCustomizerColor}"`,
      `strokeWidth={${customStrokeWidth}}`,
      absoluteStrokeWidth ? `vectorEffect="non-scaling-stroke"` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const snippet = [
      `import { ${selectedIcon.componentName} } from "@/generated/components/${selectedIcon.componentName}";`,
      "",
      `export default function Example() {`,
      `  return <${selectedIcon.componentName} ${iconProps} />;`,
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
            <h1>Iconix</h1>
          </div>
        </div>

        <section className="sidebar-block sidebar-customizer">
          <div className="sidebar-block-head">
            <span>Customizer</span>
          </div>

          <div className="customizer-field">
            <label className="customizer-label" htmlFor="icon-color-value">
              Color
            </label>
            <div className="customizer-color-row">
              <input
                aria-label="Pick icon color"
                className="customizer-color-swatch"
                onChange={(event) => {
                  setCustomColor(event.target.value);
                  setIsCustomColorDirty(true);
                }}
                type="color"
                value={resolvedCustomizerColor}
              />
              <input
                id="icon-color-value"
                aria-label="Icon color hex value"
                className="customizer-input"
                onChange={(event) => {
                  setCustomColor(event.target.value);
                  setIsCustomColorDirty(true);
                }}
                spellCheck={false}
                type="text"
                value={customColor}
              />
            </div>
          </div>

          <div className="customizer-field">
            <label className="customizer-label" htmlFor="icon-stroke-width">
              Stroke width
            </label>
            <div className="customizer-stepper">
              <input
                id="icon-stroke-width"
                aria-label="Icon stroke width"
                className="customizer-number"
                min="1"
                onChange={(event) => setCustomStrokeWidth(Number(event.target.value) || 1)}
                step="0.5"
                type="number"
                value={customStrokeWidth}
              />
              <span>px</span>
            </div>
          </div>

          <div className="customizer-field">
            <label className="customizer-label" htmlFor="icon-size">
              Size
            </label>
            <div className="customizer-stepper">
              <input
                id="icon-size"
                aria-label="Icon size"
                className="customizer-number"
                min="12"
                onChange={(event) => setCustomSize(Number(event.target.value) || 12)}
                step="1"
                type="number"
                value={customSize}
              />
              <span>px</span>
            </div>
          </div>

          <label className="customizer-toggle">
            <input
              checked={absoluteStrokeWidth}
              onChange={(event) => setAbsoluteStrokeWidth(event.target.checked)}
              type="checkbox"
            />
            <span>Absolute stroke width</span>
          </label>
        </section>

        <section className="sidebar-block sidebar-category-block">
          <div className="sidebar-block-head">
            <span>Categories</span>
            <strong>{formatCount(categoryEntries.length)}</strong>
          </div>
          <button
            className={`sidebar-item ${activeCategoryNav === "overview" ? "active" : ""}`}
            onClick={() => scrollToCategory("overview")}
            type="button"
          >
            <span className="sidebar-item-label">All</span>
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
                <span className="sidebar-item-label">{name}</span>
                <strong>{formatCount(count)}</strong>
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
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              type="button"
            >
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
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
            <div className="search-wrapper">
              <input
                ref={searchRef}
                aria-label="Search icons"
                className="input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Search icons  ( / to focus )'
                value={query}
              />
              {query && (
                <button
                  aria-label="Clear search"
                  className="search-clear"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  ×
                </button>
              )}
            </div>

            <div className="select-shell">
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
              <span aria-hidden="true" className="select-chevron">
                ˅
              </span>
            </div>

            <div className="select-shell">
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
              <span aria-hidden="true" className="select-chevron">
                ˅
              </span>
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
                          <img alt={icon.label} loading="lazy" src={iconSrc(icon.slug)} />
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
                <img
                  alt={selectedIcon.label}
                  src={iconSrc(selectedIcon.slug)}
                  style={{
                    width: Math.min(customSize, 56),
                    height: Math.min(customSize, 56),
                  }}
                />
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
