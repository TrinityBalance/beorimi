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
  const estimatedTotal = getEstimatedFeeTotal(selected);

  return {
    title: first
      ? `${first.label}${extraCount > 0 ? ` 외 ${extraCount}개` : ""}`
      : "판별할 품목 없음",
    confidence: average,
    description: estimatedTotal === null
      ? `${selected.length}개 품목 · 수수료 공식 확인 필요`
      : `${selected.length}개 품목 · ${result.demo ? "데모 예상 " : "예상 "}${estimatedTotal.toLocaleString("ko-KR")}원`,
    status: "AI 다중 품목 판독",
  };
}

export function getEstimatedFeeTotal(items: DetectedWasteItem[]) {
  if (items.length === 0 || items.some((item) => item.estimatedFee === undefined)) {
    return null;
  }

  return items.reduce(
    (total, item) => total + getItemEstimatedFee(item),
    0,
  );
}

export function getItemEstimatedFee(item: DetectedWasteItem) {
  return (item.estimatedFee ?? 0) * Math.max(1, item.quantity ?? 1);
}
