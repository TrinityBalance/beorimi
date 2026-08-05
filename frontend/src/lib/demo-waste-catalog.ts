import type { WasteCatalogItem } from "@/types/analysis";

export const DEMO_WASTE_CATALOG: WasteCatalogItem[] = [
  {
    name: "사무용 의자",
    sizeGuide: "바퀴나 회전축이 있는지 먼저 확인해주세요.",
    sizes: [
      { label: "일반형", fee: 2000, guide: "고정 다리로 되어 있고 회전하지 않는 형태" },
      { label: "회전형", fee: 3000, guide: "회전축 또는 바퀴가 달린 사무용 형태" },
    ],
  },
  {
    name: "일반 의자",
    sizeGuide: "팔걸이·쿠션 유무보다 한 사람이 앉는 고정형 의자인지 확인해주세요.",
    sizes: [{ label: "일반형", fee: 2000, guide: "한 사람이 앉는 고정 다리 의자" }],
  },
  {
    name: "1인용 소파",
    sizeGuide: "실제로 앉을 수 있는 좌석 수를 기준으로 선택해주세요.",
    sizes: [{ label: "1인용", fee: 3000, guide: "한 사람이 앉는 소파 또는 안락의자 크기" }],
  },
  {
    name: "2~3인용 소파",
    sizeGuide: "실제로 앉을 수 있는 좌석 수를 기준으로 선택해주세요.",
    sizes: [{ label: "2~3인용", fee: 8000, guide: "성인 두세 명이 나란히 앉는 일반 소파" }],
  },
  {
    name: "4인용 이상 소파",
    sizeGuide: "분리형 소파는 실제 신고할 조각 수와 규격을 공식 사이트에서 다시 확인해주세요.",
    sizes: [{ label: "4인용 이상", fee: 12000, guide: "성인 네 명 이상이 앉거나 코너가 이어진 대형 소파" }],
  },
  {
    name: "소파베드",
    sizeGuide: "등받이나 좌판을 펼쳐 침대로 사용할 수 있는 구조인지 확인해주세요.",
    sizes: [{ label: "일반형", fee: 8000, guide: "접거나 펼쳐 침대로 변환되는 소파" }],
  },
  {
    name: "수납장",
    sizeGuide: "가장 긴 면을 기준으로 비교하세요. 정확한 구간은 공식 신고 페이지에서 확인해야 해요.",
    sizes: [
      { label: "소형", fee: 5000, guide: "협탁처럼 허리 아래에 오는 작은 수납장" },
      { label: "중형", fee: 7000, guide: "서랍장처럼 허리~가슴 높이의 수납장" },
      { label: "대형", fee: 10000, guide: "옷장처럼 성인 키에 가까운 큰 수납장" },
    ],
  },
  {
    name: "책상",
    sizeGuide: "상판의 가장 긴 가로 길이를 기준으로 비교해주세요.",
    sizes: [
      { label: "소형", fee: 4000, guide: "1인 학습용처럼 폭이 좁은 책상" },
      { label: "대형", fee: 7000, guide: "2인용·사무용처럼 상판이 넓은 책상" },
    ],
  },
  {
    name: "매트리스",
    sizeGuide: "침대 프레임이 아니라 매트리스 폭과 표준 침대 규격을 확인해주세요.",
    sizes: [
      { label: "싱글", fee: 5000, guide: "한 사람이 사용하는 싱글·슈퍼싱글 폭" },
      { label: "더블 이상", fee: 8000, guide: "두 사람이 사용하는 더블·퀸·킹 폭" },
    ],
  },
];
