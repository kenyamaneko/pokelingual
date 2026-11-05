import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { spec } from "../../test/labels";
import { LocationSelect } from "./LocationSelect";
import type { QuestLocation } from "../../../../shared/api-types/quest";

const locations: QuestLocation[] = [
  { id: "place-a", name: "テスト草原", description: "みどりの草原", types: ["grass", "normal"] },
  { id: "place-b", name: "テスト洞窟", description: "くらい洞窟", types: ["rock"] },
];

describe("[本体:出題]場所選択画面", () => {
  describe("場所「テスト草原」(説明「みどりの草原」) が選べるとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("場所の説明「みどりの草原」が表示される", () => {
          render(<LocationSelect locations={locations} onSelect={() => {}} />);
          expect(screen.getByText("みどりの草原")).toBeInTheDocument();
        });
      });
    });
  });

  describe("単体テスト", () => {
    describe("正常系", () => {
      it.each([
        ["選べる場所が「テスト草原」と「テスト洞窟」の 2 件", locations],
        ["選べる場所が「テスト草原」の 1 件だけ", [locations[0]]],
      ])("%sのとき、場所の名前「テスト草原」が表示される", (_given, selectable) => {
        render(<LocationSelect locations={selectable} onSelect={() => {}} />);
        expect(screen.getByText("テスト草原")).toBeInTheDocument();
      });

      it("選べる場所が 0 件のとき、「行き先を　探しています」と表示される", () => {
        render(<LocationSelect locations={[]} onSelect={() => {}} />);
        expect(screen.getByText(spec("行き先を　探しています"))).toBeInTheDocument();
      });
    });
  });
});
