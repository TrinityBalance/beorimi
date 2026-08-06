import assert from "node:assert/strict";
import test from "node:test";
import { classifyDisposal } from "./disposal.ts";

test("recyclable packaging is marked as not eligible", () => {
  const result = classifyDisposal({ label: "투명 페트병", category: "packaging" }, false);

  assert.equal(result.bulky_waste_status, "not_eligible");
  assert.match(result.disposal_notice ?? "", /재활용 분리배출/);
});

test("dedicated battery collection is marked as not eligible", () => {
  const result = classifyDisposal({ label: "보조배터리", category: "battery_lamp" }, false);

  assert.equal(result.bulky_waste_status, "not_eligible");
  assert.match(result.disposal_notice ?? "", /전용 수거함/);
});

test("an official catalog match remains eligible", () => {
  const result = classifyDisposal({ label: "일반 의자", category: "furniture" }, true);

  assert.equal(result.bulky_waste_status, "eligible");
  assert.equal(result.disposal_notice, null);
});

test("a catalog miss requires confirmation instead of being rejected", () => {
  const result = classifyDisposal({ label: "알 수 없는 가구", category: "furniture" }, false);

  assert.equal(result.bulky_waste_status, "needs_confirmation");
});
