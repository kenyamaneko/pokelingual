import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LocationSelect } from "./LocationSelect";
import type { QuestLocation } from "../../../../shared/api-types/quest";

const locations: QuestLocation[] = [
  { id: "place-a", name: "テスト草原", description: "みどりの草原", types: ["grass", "normal"] },
  { id: "place-b", name: "テスト洞窟", description: "くらい洞窟", types: ["rock"] },
];

describe("LocationSelect", () => {
  it("候補の場所を名前・説明付きで表示する", () => {
    render(<LocationSelect locations={locations} onSelect={() => {}} />);
    expect(screen.getByText("テスト草原")).toBeInTheDocument();
    expect(screen.getByText("みどりの草原")).toBeInTheDocument();
  });

  it("候補を取得できるまでは読み込み中を表示する", () => {
    render(<LocationSelect locations={[]} onSelect={() => {}} />);
    expect(screen.getByText(/探しています/)).toBeInTheDocument();
  });
});
