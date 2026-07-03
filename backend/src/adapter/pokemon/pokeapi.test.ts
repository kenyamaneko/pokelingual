import { describe, it, expect } from "vitest";
import { cleanFlavorText } from "./pokeapi.js";

describe("cleanFlavorText", () => {
  it("改行・改ページ・復帰をスペースに置換する", () => {
    expect(cleanFlavorText("A\fB\nC\rD")).toBe("A B C D");
  });

  it("連続スペースを 1 つに畳み、前後をトリムする", () => {
    expect(cleanFlavorText("  A   B  ")).toBe("A B");
  });
});
