import type { Language } from "./copy";

type LibrarySeed = {
  id: string;
  labels: Record<Language, string>;
  category: "organ" | "signal" | "cell" | "process" | "container" | "outcome";
  keywords: string[];
  semanticRoles: Array<"entity" | "process" | "outcome" | "context" | "annotation" | "panel">;
  colors: {
    base: string;
    accent: string;
  };
  assetUri?: string;
};

export type ElementLibraryItem = {
  id: string;
  label: string;
  category: LibrarySeed["category"];
  keywords: string[];
  semanticRoles: LibrarySeed["semanticRoles"];
  assetUri: string;
  previewUri: string;
};

export type LibraryCategoryId = ElementLibraryItem["category"];

const LIBRARY_SEEDS: LibrarySeed[] = [
  {
    id: "kidney-clean",
    labels: { en: "Kidney", "zh-CN": "肾脏" },
    category: "organ",
    keywords: ["kidney", "renal", "aki", "肾"],
    semanticRoles: ["entity", "outcome"],
    colors: { base: "#c55d6d", accent: "#873443" },
    assetUri: "/library/kidney-clean.svg",
  },
  {
    id: "mitochondria",
    labels: { en: "Mitochondria", "zh-CN": "线粒体" },
    category: "organ",
    keywords: ["mitochondria", "mitochondrial", "线粒体"],
    semanticRoles: ["entity", "process"],
    colors: { base: "#df8f3a", accent: "#995214" },
    assetUri: "/library/mitochondria.svg",
  },
  {
    id: "bacteria",
    labels: { en: "Bacteria", "zh-CN": "细菌" },
    category: "signal",
    keywords: ["bacteria", "bacterial", "infection", "sepsis", "细菌", "感染"],
    semanticRoles: ["context", "entity"],
    colors: { base: "#0c8f8a", accent: "#07595a" },
    assetUri: "/library/bacteria.svg",
  },
  {
    id: "immune-cell",
    labels: { en: "Immune Cell", "zh-CN": "免疫细胞" },
    category: "cell",
    keywords: ["immune", "macrophage", "neutrophil", "免疫"],
    semanticRoles: ["entity", "process"],
    colors: { base: "#6988d8", accent: "#38558f" },
    assetUri: "/library/immune-cell.svg",
  },
  {
    id: "inflammation",
    labels: { en: "Inflammation", "zh-CN": "炎症反应" },
    category: "process",
    keywords: ["inflammation", "inflam", "cytokine", "炎症"],
    semanticRoles: ["process", "annotation"],
    colors: { base: "#d45f4b", accent: "#8b3429" },
    assetUri: "/library/inflammation.svg",
  },
  {
    id: "protective-shield",
    labels: { en: "Protection", "zh-CN": "保护屏障" },
    category: "outcome",
    keywords: ["protect", "barrier", "shield", "repair", "保护"],
    semanticRoles: ["outcome", "annotation"],
    colors: { base: "#6a9f5d", accent: "#3c6a33" },
    assetUri: "/library/protective-shield.svg",
  },
  {
    id: "membrane",
    labels: { en: "Membrane", "zh-CN": "膜结构" },
    category: "container",
    keywords: ["membrane", "membranous", "膜"],
    semanticRoles: ["panel", "entity"],
    colors: { base: "#7f8bb0", accent: "#4c5772" },
  },
  {
    id: "nucleus",
    labels: { en: "Nucleus", "zh-CN": "细胞核" },
    category: "organ",
    keywords: ["nucleus", "nuclear", "核"],
    semanticRoles: ["entity"],
    colors: { base: "#8f72bf", accent: "#5c428b" },
  },
  {
    id: "oxidative-stress",
    labels: { en: "Oxidative Stress", "zh-CN": "氧化应激" },
    category: "process",
    keywords: ["oxidative", "stress", "ros", "氧化应激"],
    semanticRoles: ["process", "annotation"],
    colors: { base: "#d18f2a", accent: "#8a5816" },
  },
  {
    id: "apoptosis",
    labels: { en: "Apoptosis", "zh-CN": "细胞凋亡" },
    category: "outcome",
    keywords: ["apoptosis", "cell death", "凋亡"],
    semanticRoles: ["outcome", "process"],
    colors: { base: "#b85d5d", accent: "#7a3333" },
  },
  {
    id: "cytokine-signal",
    labels: { en: "Cytokine Signal", "zh-CN": "细胞因子信号" },
    category: "signal",
    keywords: ["cytokine", "signal", "细胞因子"],
    semanticRoles: ["process", "entity"],
    colors: { base: "#3f9ca6", accent: "#205a60" },
  },
  {
    id: "outcome-panel",
    labels: { en: "Outcome Panel", "zh-CN": "结果面板" },
    category: "container",
    keywords: ["panel", "result", "outcome", "结果"],
    semanticRoles: ["panel", "annotation"],
    colors: { base: "#5e8c79", accent: "#345646" },
  },
  {
    id: "endothelium",
    labels: { en: "Endothelium", "zh-CN": "内皮层" },
    category: "container",
    keywords: ["endothelium", "endothelial", "vascular", "内皮"],
    semanticRoles: ["entity", "panel", "context"],
    colors: { base: "#5d8aa8", accent: "#31556d" },
  },
  {
    id: "tubule-cell",
    labels: { en: "Tubular Cell", "zh-CN": "肾小管细胞" },
    category: "cell",
    keywords: ["tubule", "tubular", "epithelial", "肾小管"],
    semanticRoles: ["entity", "process"],
    colors: { base: "#c97c5d", accent: "#8a4c35" },
  },
  {
    id: "macrophage",
    labels: { en: "Macrophage", "zh-CN": "巨噬细胞" },
    category: "cell",
    keywords: ["macrophage", "phagocyte", "immune", "巨噬"],
    semanticRoles: ["entity", "process"],
    colors: { base: "#779b5f", accent: "#496537" },
  },
  {
    id: "fibrosis",
    labels: { en: "Fibrosis", "zh-CN": "纤维化" },
    category: "outcome",
    keywords: ["fibrosis", "scar", "纤维化"],
    semanticRoles: ["outcome", "annotation"],
    colors: { base: "#8f6f8e", accent: "#5d425c" },
  },
  {
    id: "necrosis",
    labels: { en: "Necrosis", "zh-CN": "坏死" },
    category: "outcome",
    keywords: ["necrosis", "necrotic", "坏死"],
    semanticRoles: ["outcome", "annotation"],
    colors: { base: "#a4534a", accent: "#6d312b" },
  },
  {
    id: "drug-intervention",
    labels: { en: "Drug Intervention", "zh-CN": "药物干预" },
    category: "signal",
    keywords: ["drug", "therapy", "treatment", "inhibitor", "药物"],
    semanticRoles: ["context", "process", "annotation"],
    colors: { base: "#3f8f86", accent: "#255952" },
  },
  {
    id: "mitophagy",
    labels: { en: "Mitophagy", "zh-CN": "线粒体自噬" },
    category: "process",
    keywords: ["mitophagy", "autophagy", "自噬"],
    semanticRoles: ["process", "annotation"],
    colors: { base: "#bf9158", accent: "#7b5b31" },
  },
  {
    id: "ros-burst",
    labels: { en: "ROS Burst", "zh-CN": "ROS 爆发" },
    category: "signal",
    keywords: ["ros", "reactive oxygen", "oxidative", "ROS"],
    semanticRoles: ["process", "entity"],
    colors: { base: "#d37a2f", accent: "#8d4d18" },
  },
];

function buildPreviewSvg(label: string, base: string, accent: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${base}" stop-opacity="0.2" />
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.34" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="28" fill="#fbfaf7" />
      <rect x="18" y="18" width="284" height="164" rx="24" fill="url(#g)" stroke="${base}" stroke-width="2" />
      <path d="M64 120c0-32 26-58 58-58 18 0 36 8 47 22 11-14 29-22 47-22 32 0 58 26 58 58 0 18-7 34-19 45H83c-12-11-19-27-19-45Z" fill="${base}" fill-opacity="0.22" stroke="${accent}" stroke-width="4" />
      <path d="M98 118h124" stroke="${accent}" stroke-width="10" stroke-linecap="round" />
      <path d="M126 93c10 10 20 15 34 15 14 0 24-5 34-15" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" />
      <text x="24" y="42" font-family="Trebuchet MS, sans-serif" font-size="17" fill="#1f2a35">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getElementLibrary(language: Language): ElementLibraryItem[] {
  return LIBRARY_SEEDS.map((seed) => {
    const label = seed.labels[language];
    const previewUri = seed.assetUri ?? buildPreviewSvg(label, seed.colors.base, seed.colors.accent);
    return {
      id: seed.id,
      label,
      category: seed.category,
      keywords: seed.keywords,
      semanticRoles: seed.semanticRoles,
      assetUri: seed.assetUri ?? previewUri,
      previewUri,
    };
  });
}

export function getLibraryCategories(language: Language): Array<{ id: LibraryCategoryId; label: string }> {
  return [
    { id: "organ", label: language === "zh-CN" ? "器官" : "Organs" },
    { id: "cell", label: language === "zh-CN" ? "细胞" : "Cells" },
    { id: "signal", label: language === "zh-CN" ? "信号与通路" : "Signals & Pathways" },
    { id: "container", label: language === "zh-CN" ? "结构" : "Structures" },
    { id: "outcome", label: language === "zh-CN" ? "损伤与结果" : "Injury & Outcomes" },
    { id: "process", label: language === "zh-CN" ? "过程" : "Processes" },
  ];
}

function scoreLibraryItem(item: ElementLibraryItem, query: string): number {
  if (!query) {
    return 0;
  }
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const itemTokens = [item.label, ...item.keywords].map((token) => token.toLowerCase());
  return itemTokens.reduce(
    (score, token) =>
      score +
      queryTokens.reduce((tokenScore, queryToken) => {
        if (token === queryToken) {
          return tokenScore + 3;
        }
        if (token.includes(queryToken) || queryToken.includes(token)) {
          return tokenScore + 1;
        }
        return tokenScore;
      }, 0),
    0,
  );
}

export function searchLibraryItems(items: ElementLibraryItem[], query: string): ElementLibraryItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return [...items].sort((left, right) => {
    const leftScore = scoreLibraryItem(left, normalized);
    const rightScore = scoreLibraryItem(right, normalized);
    return rightScore - leftScore || left.label.localeCompare(right.label);
  });
}

export function getRecommendedLibraryItems(language: Language, context: string, category?: LibraryCategoryId): ElementLibraryItem[] {
  const normalized = context.trim().toLowerCase();
  const items = getElementLibrary(language).filter((item) => (category ? item.category === category : true));
  return items
    .map((item) => ({ item, score: scoreLibraryItem(item, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label))
    .map((entry) => entry.item);
}

export function getLibraryItemById(language: Language, id: string): ElementLibraryItem | null {
  return getElementLibrary(language).find((item) => item.id === id) ?? null;
}
