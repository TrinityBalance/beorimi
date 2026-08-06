export type DisposalClassification = {
  bulky_waste_status: "eligible" | "not_eligible" | "needs_confirmation";
  disposal_notice: string | null;
  disposal_guidance_url: string;
};

const bulkyWasteGuidanceUrl =
  "https://clean.gangnam.go.kr/use/biwa/USEBIWA01000000.do";
const recyclingGuidanceUrl =
  "https://clean.gangnam.go.kr/use/guid/USEGUID01000000.do?contentId=con2411150005";

const recyclablePackagingNames = [
  "페트병",
  "종이 박스",
  "종이박스",
  "골판지",
  "캔",
  "유리병",
  "비닐",
  "pet bottle",
  "paper box",
  "cardboard",
  "aluminum can",
  "glass bottle",
  "plastic bag",
];
const dedicatedCollectionNames = [
  "건전지",
  "보조배터리",
  "충전지",
  "형광등",
  "led 전구",
  "led 램프",
  "battery",
  "fluorescent lamp",
];

export function normalizeItemName(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function classifyDisposal(
  item: Record<string, unknown>,
  hasFeeCatalogRule: boolean,
  catalogIsFree = false,
): DisposalClassification {
  const name = typeof item.label === "string"
    ? normalizeItemName(item.label)
    : "";
  const category = typeof item.category === "string" ? item.category : "";
  const matches = (candidates: string[]) =>
    candidates.some((candidate) => name.includes(normalizeItemName(candidate)));

  // AIDEV-NOTE: Only explicit separate-collection matches are rejected; catalog misses need confirmation.
  if (category === "packaging" && matches(recyclablePackagingNames)) {
    return {
      bulky_waste_status: "not_eligible",
      disposal_notice:
        "재활용 분리배출 대상이라 대형생활폐기물 신고 대상이 아닙니다. 내용물을 비우고 품목별 분리배출 방법을 확인해주세요.",
      disposal_guidance_url: recyclingGuidanceUrl,
    };
  }
  if (category === "battery_lamp" && matches(dedicatedCollectionNames)) {
    return {
      bulky_waste_status: "not_eligible",
      disposal_notice:
        "폐건전지·폐형광등 전용 수거함 분리배출 대상이라 대형생활폐기물 신고 대상이 아닙니다.",
      disposal_guidance_url: recyclingGuidanceUrl,
    };
  }
  if (hasFeeCatalogRule) {
    if (catalogIsFree) {
      return {
        bulky_waste_status: "eligible",
        disposal_notice:
          "강남구 공식 목록의 무상수거 품목입니다. 신청 전에 무상수거 조건과 배출 방법을 확인해주세요.",
        disposal_guidance_url: bulkyWasteGuidanceUrl,
      };
    }
    return {
      bulky_waste_status: "eligible",
      disposal_notice: null,
      disposal_guidance_url: bulkyWasteGuidanceUrl,
    };
  }
  return {
    bulky_waste_status: "needs_confirmation",
    disposal_notice:
      "공식 수거대상 목록에서 정확히 일치하는 품목을 찾지 못했습니다. 유사 품목 또는 기타 품목으로 신고 가능한지 확인해주세요.",
    disposal_guidance_url: bulkyWasteGuidanceUrl,
  };
}
