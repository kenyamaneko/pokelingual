import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LocationSelect } from "./LocationSelect";
import type { QuestLocation } from "../../../../shared/api-types/quest";

const locations: QuestLocation[] = [
  { id: "place-a", name: "テスト草原", description: "みどりの草原", types: ["grass", "normal"] },
  { id: "place-b", name: "テスト洞窟", description: "くらい洞窟", types: ["rock"] },
];

describe("[クエスト] 場所選択画面", () => {
  describe("正常系", () => {
    describe("選べる場所があるとき", () => {
      it("場所の名前が表示される", () => {
        render(<LocationSelect locations={locations} onSelect={() => {}} />);
        expect(screen.getByText("テスト草原")).toBeInTheDocument();
      });

      it("場所の説明が表示される", () => {
        render(<LocationSelect locations={locations} onSelect={() => {}} />);
        expect(screen.getByText("みどりの草原")).toBeInTheDocument();
      });
    });

    it("選べる場所が 0 件のとき、「行き先を　探しています」と表示される", () => {
      render(<LocationSelect locations={[]} onSelect={() => {}} />);
      expect(screen.getByText(/探しています/)).toBeInTheDocument();
    });
  });
});
