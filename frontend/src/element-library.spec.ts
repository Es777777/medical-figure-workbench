import { describe, expect, it } from "vitest";

import { getElementLibrary, getLibraryCategories, getRecommendedLibraryItems, searchLibraryItems } from "./element-library";

describe("element library organization", () => {
  it("exposes stable medical categories", () => {
    expect(getLibraryCategories("en")).toEqual([
      { id: "organ", label: "Organs" },
      { id: "cell", label: "Cells" },
      { id: "signal", label: "Signals & Pathways" },
      { id: "container", label: "Structures" },
      { id: "outcome", label: "Injury & Outcomes" },
      { id: "process", label: "Processes" },
    ]);
  });

  it("finds renal-related assets with keyword search", () => {
    const results = searchLibraryItems(getElementLibrary("en"), "renal injury");
    expect(results.map((item) => item.id)).toContain("kidney-clean");
  });

  it("prefers macrophage-like assets for immune context", () => {
    const results = getRecommendedLibraryItems("en", "immune macrophage activation");
    expect(results[0]?.id).toBe("macrophage");
  });
});
