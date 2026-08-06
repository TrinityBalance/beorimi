import assert from "node:assert/strict";
import test from "node:test";
import { type FeeCatalogRule, findFeeCatalogMatch } from "./fee-catalog.ts";

function rule(
  key: string,
  fee: number,
  specification: string,
  overrides: Partial<FeeCatalogRule> = {},
): FeeCatalogRule {
  return {
    rule_key: key,
    item_name: "쇼파",
    aliases: ["쇼파", "소파"],
    category: "furniture",
    fee,
    size_label: specification,
    min_longest_side_cm: null,
    max_longest_side_cm: null,
    specification,
    match_kind: "label",
    ...overrides,
  };
}

test("an official item with one specification returns its fee", () => {
  const match = findFeeCatalogMatch(
    { label: "안마의자", category: "furniture" },
    [rule("massage-chair", 20000, "모든 규격", {
      item_name: "안마의자",
      aliases: ["안마의자"],
      match_kind: "all",
    })],
  );

  assert.equal(match.matched, true);
  assert.equal(match.fee, 20000);
  assert.equal(match.feeMin, 20000);
  assert.equal(match.feeMax, 20000);
});

test("a specification stated in the label selects the official row", () => {
  const match = findFeeCatalogMatch(
    { label: "3인용 소파", category: "furniture" },
    [rule("sofa-2", 5000, "2인용"), rule("sofa-3", 7000, "3인용")],
  );

  assert.equal(match.fee, 7000);
  assert.equal(match.sizeLabel, "3인용");
});

test("an ambiguous specification returns the official fee range", () => {
  const match = findFeeCatalogMatch(
    { label: "소파", category: "furniture" },
    [rule("sofa-2", 5000, "2인용"), rule("sofa-3", 7000, "3인용")],
  );

  assert.equal(match.matched, true);
  assert.equal(match.itemName, "쇼파");
  assert.equal(match.fee, null);
  assert.equal(match.feeMin, 5000);
  assert.equal(match.feeMax, 7000);
});

test("a generic chair still exposes an expected fee range", () => {
  const match = findFeeCatalogMatch(
    { label: "사무용 의자", category: "furniture" },
    [
      rule("chair-single", 2000, "1인용", {
        item_name: "의자",
        aliases: ["의자", "chair"],
      }),
      rule("chair-bench", 3000, "장의자", {
        item_name: "의자",
        aliases: ["의자", "chair"],
      }),
      rule("chair-wheeled", 5000, "바퀴달린의자(대형)", {
        item_name: "의자",
        aliases: ["의자", "chair"],
      }),
    ],
  );

  assert.equal(match.fee, null);
  assert.equal(match.feeMin, 2000);
  assert.equal(match.feeMax, 5000);
});

test("a numeric range in a label remains ambiguous", () => {
  const match = findFeeCatalogMatch(
    { label: "2~3인용 소파", category: "furniture" },
    [rule("sofa-2", 5000, "2인용"), rule("sofa-3", 7000, "3인용")],
  );

  assert.equal(match.fee, null);
  assert.equal(match.feeMin, 5000);
  assert.equal(match.feeMax, 7000);
});

test("explicit longest-side rules can use a measured longest side", () => {
  const match = findFeeCatalogMatch(
    { label: "화이트보드", category: "other", longest_side_cm: 120 },
    [
      rule("board-small", 1000, "가장 긴면 1m미만", {
        item_name: "게시판(화이트보드)",
        aliases: ["화이트보드"],
        match_kind: "longest_side_cm",
        max_longest_side_cm: 99,
      }),
      rule("board-large", 2000, "가장 긴면 1m이상", {
        item_name: "게시판(화이트보드)",
        aliases: ["화이트보드"],
        match_kind: "longest_side_cm",
        min_longest_side_cm: 100,
      }),
    ],
  );

  assert.equal(match.fee, 2000);
});
