import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LocationSelect } from "./LocationSelect";
import type { QuestLocation } from "../../../../shared/api-types/quest";

const locations: QuestLocation[] = [
  { id: "place-a", name: "テスト草原", description: "みどりの草原", types: ["grass", "normal"] },
  { id: "place-b", name: "テスト洞窟", description: "くらい洞窟", types: ["rock"] },
];

describe("LocationSelect", () => {
  it("候補の場所を名前・説明・日本語タイプ付きで表示する", () => {
    render(<LocationSelect locations={locations} onSelect={() => {}} />);
    expect(screen.getByText("テスト草原")).toBeInTheDocument();
    expect(screen.getByText("みどりの草原")).toBeInTheDocument();
    expect(screen.getByText("くさ")).toBeInTheDocument();
    expect(screen.getByText("ノーマル")).toBeInTheDocument();
  });

  it("場所を選ぶと、その場所 ID で onSelect が呼ばれる", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<LocationSelect locations={locations} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /テスト洞窟/ }));

    expect(onSelect).toHaveBeenCalledWith("place-b");
  });

  it("候補が無い間は読み込み表示になる", () => {
    render(<LocationSelect locations={[]} onSelect={() => {}} />);
    expect(screen.getByText(/行き先を/)).toBeInTheDocument();
  });
});
