import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("onboarding smoke guard", () => {
  it("expects an onboarding card class in the stylesheet", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../styles.css"), "utf8");
    expect(css).toContain(".onboarding-card");
  });
});
