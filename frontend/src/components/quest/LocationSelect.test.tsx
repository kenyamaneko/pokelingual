import { render, screen } from "@testing-library/react";
import { describe, expect } from "vitest";
import { spec } from "../../test/labels";
import { LocationSelect } from "./LocationSelect";
import type { QuestLocation } from "../../../../shared/api-types/quest";
import { defineCase } from "../../test/defineCase";

const locations: QuestLocation[] = [
  { id: "place-a", name: "テスト草原", description: "みどりの草原", types: ["grass", "normal"] },
  { id: "place-b", name: "テスト洞窟", description: "くらい洞窟", types: ["rock"] },
];

const SHOW_LOCATION_SELECT = "クエストの場所選択画面で、選べる場所を表示する";

describe("[本体:クエスト]場所選択画面", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "場所「テスト草原」(説明「みどりの草原」) が選べるとき",
          When: [SHOW_LOCATION_SELECT],
          Then: "場所の説明「みどりの草原」が表示される",
        },
      ],
    },
    () => {
      render(<LocationSelect locations={locations} onSelect={() => {}} />);
      expect(screen.getByText("みどりの草原")).toBeInTheDocument();
    },
  );

  for (const { given, selectable } of [
    { given: "選べる場所が「テスト草原」と「テスト洞窟」の 2 件", selectable: locations },
    { given: "選べる場所が「テスト草原」の 1 件だけ", selectable: [locations[0]] },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `${given}のとき`, When: [SHOW_LOCATION_SELECT], Then: "場所の名前「テスト草原」が表示される" }],
      },
      () => {
        render(<LocationSelect locations={selectable} onSelect={() => {}} />);
        expect(screen.getByText("テスト草原")).toBeInTheDocument();
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "選べる場所が 0 件のとき", When: [SHOW_LOCATION_SELECT], Then: "「行き先を　探しています」と表示される" }],
    },
    () => {
      render(<LocationSelect locations={[]} onSelect={() => {}} />);
      expect(screen.getByText(spec("行き先を　探しています"))).toBeInTheDocument();
    },
  );
});
