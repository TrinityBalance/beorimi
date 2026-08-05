import type { SelectionRegion, WasteAnalysisResult } from "@/types/analysis";

export const runtime = "nodejs";

type AnalysisResponse = Omit<WasteAnalysisResult, "image">;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const regionValue = formData.get("region");

    if (!(image instanceof File) || !image.type.startsWith("image/")) {
      return Response.json(
        { message: "분석할 이미지가 필요합니다." },
        { status: 400 },
      );
    }

    if (image.size > 10 * 1024 * 1024) {
      return Response.json(
        { message: "이미지는 10MB 이하여야 합니다." },
        { status: 413 },
      );
    }

    let region: SelectionRegion | null = null;
    if (typeof regionValue === "string" && regionValue) {
      region = JSON.parse(regionValue) as SelectionRegion;
    }

    await new Promise((resolve) => setTimeout(resolve, 1250));

    const id = crypto.randomUUID();
    const result: AnalysisResponse = {
      id,
      createdAt: new Date().toISOString(),
      district: "서울 강남구",
      imageName: image.name,
      region,
      primary: {
        name: "1인용 소파",
        confidence: 78,
        fee: 3000,
        size: "1인용",
      },
      candidates: [
        { name: "의자", confidence: 14, fee: 2000, size: "일반형" },
        { name: "소파베드", confidence: 8, fee: 8000, size: "1인용" },
      ],
      reportRequired: true,
      disposal: {
        summary: "대형생활폐기물로 신고한 뒤 지정된 장소에 배출해주세요.",
        steps: [
          "강남구 자원순환 종합포털에서 배출 3일 전까지 신고해요.",
          "접수번호와 연락처를 종이에 적어 폐기물에 잘 보이게 붙여요.",
          "신청한 날짜에 건물 앞 또는 공동주택 지정 장소에 내놓아요.",
        ],
        cautions: [
          "수거는 월~토요일에 진행되며 일요일과 공휴일은 제외돼요.",
          "사진만으로 정확한 규격 측정은 어려워 신고 단계에서 크기를 다시 확인해주세요.",
        ],
      },
      source: {
        label: "강남구청 대형생활폐기물 배출 안내",
        url: "https://www.gangnam.go.kr/waste/apply/info.do?mid=ID03_020704",
        checkedAt: "2026.08.05 확인",
      },
      demo: true,
    };

    return Response.json(result);
  } catch {
    return Response.json(
      { message: "사진을 분석하는 중 문제가 발생했습니다." },
      { status: 500 },
    );
  }
}
