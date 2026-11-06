import { render, screen } from "@testing-library/react";
import { describe, expect } from "vitest";
import { spec } from "../../test/labels";
import { LocationSelect } from "./LocationSelect";
import type { QuestLocation } from "../../../../shared/api-types/quest";
import { defineCase } from "../../test/defineCase";

const locations: QuestLocation[] = [
  { id: "place-a", name: "木漏れ日の森", description: "やわらかい光と、虫の声", types: ["grass", "normal"] },
  { id: "place-b", name: "きらめく水晶の洞窟", description: "無数の水晶がきらめき、時おりパチッと火花が散る", types: ["rock"] },
];

const OPEN_LOCATION_SELECT = "場所選択画面を開く";

describe("[本体:クエスト]場所選択画面", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "説明が「やわらかい光と、虫の声」の場所「木漏れ日の森」が選べるとき",
          When: [OPEN_LOCATION_SELECT],
          Then: "場所選択画面に説明「やわらかい光と、虫の声」が表示される",
        },
      ],
    },
    () => {
      render(<LocationSelect locations={locations} onSelect={() => {}} />);
      expect(screen.getByText("やわらかい光と、虫の声")).toBeInTheDocument();
    },
  );

  for (const { given, selectable } of [
    { given: "選べる場所が「木漏れ日の森」と「きらめく水晶の洞窟」の 2 件", selectable: locations },
    { given: "選べる場所が「木漏れ日の森」の 1 件だけ", selectable: [locations[0]] },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["件数・有無"],
        steps: [{ Given: `${given}のとき`, When: [OPEN_LOCATION_SELECT], Then: "場所選択画面に場所の名前「木漏れ日の森」が表示される" }],
      },
      () => {
        render(<LocationSelect locations={selectable} onSelect={() => {}} />);
        expect(screen.getByText("木漏れ日の森")).toBeInTheDocument();
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ Given: "選べる場所が 0 件のとき", When: [OPEN_LOCATION_SELECT], Then: "場所選択画面に「行き先を　探しています」と表示される" }],
    },
    () => {
      render(<LocationSelect locations={[]} onSelect={() => {}} />);
      expect(screen.getByText(spec("行き先を　探しています"))).toBeInTheDocument();
    },
  );
});
