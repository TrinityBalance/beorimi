import type {
  DetectedWasteItem,
  LegacyWasteAnalysisResult,
  MultiWasteAnalysisResult,
  WasteAnalysisResult,
} from "@/types/analysis";

export function isMultiResult(
  result: WasteAnalysisResult,
): result is MultiWasteAnalysisResult {
  return "kind" in result && result.kind === "multi";
}

export function isLegacyResult(
  result: WasteAnalysisResult,
): result is LegacyWasteAnalysisResult {
  return !isMultiResult(result);
}

export function getSelectedItems(
  result: MultiWasteAnalysisResult,
): DetectedWasteItem[] {
  return result.items.filter(
    (item) => item.selected && item.bulky_waste_status !== "not_eligible",
  );
}

export function getResultSummary(result: WasteAnalysisResult) {
  if (isLegacyResult(result)) {
    return {
      title: result.primary.name,
      confidence: result.primary.confidence,
      description: `${result.primary.fee.toLocaleString("ko-KR")}원 · 신고 필요`,
      status: "강남구 규정 확인",
    };
  }

  const selected = getSelectedItems(result);
  const first = selected[0] ?? result.items[0];
  const extraCount = Math.max(0, selected.length - 1);
  const average = selected.length
    ? Math.round(
        (selected.reduce((sum, item) => sum + item.confidence, 0) /
          selected.length) *
          100,
      )
    : 0;
  const estimatedTotal = getEstimatedFeeRangeTotal(selected);

  return {
    title: first
      ? `${first.label}${extraCount > 0 ? ` 외 ${extraCount}개` : ""}`
      : "판별할 품목 없음",
    confidence: average,
    description: estimatedTotal === null
      ? `${selected.length}개 품목 · 수수료 공식 확인 필요`
      : `${selected.length}개 품목 · ${result.demo ? "데모 예상 " : "예상 "}${formatEstimatedFeeRange(estimatedTotal)}`,
    status: "AI 다중 품목 판독",
  };
}

export type EstimatedFeeRange = {
  min: number;
  max: number;
};

export function getItemEstimatedFeeRange(
  item: DetectedWasteItem,
): EstimatedFeeRange | null {
  const quantity = Math.max(1, item.quantity ?? 1);
  if (item.estimatedFee !== undefined) {
    const total = item.estimatedFee * quantity;
    return { min: total, max: total };
  }
  if (
    item.estimatedFeeMin === undefined ||
    item.estimatedFeeMax === undefined
  ) return null;
  return {
    min: item.estimatedFeeMin * quantity,
    max: item.estimatedFeeMax * quantity,
  };
}

export function getEstimatedFeeRangeTotal(
  items: DetectedWasteItem[],
): EstimatedFeeRange | null {
  if (items.length === 0) return null;
  let min = 0;
  let max = 0;
  for (const item of items) {
    const range = getItemEstimatedFeeRange(item);
    if (!range) return null;
    min += range.min;
    max += range.max;
  }
  return { min, max };
}

export function formatEstimatedFeeRange(range: EstimatedFeeRange) {
  return range.min === range.max
    ? `${range.min.toLocaleString("ko-KR")}원`
    : `${range.min.toLocaleString("ko-KR")}~${range.max.toLocaleString("ko-KR")}원`;
}
