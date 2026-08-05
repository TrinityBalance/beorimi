import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "버리미 - 강남구 대형폐기물 AI 안내",
    short_name: "버리미",
    description: "사진으로 대형폐기물 품목과 강남구 배출 방법을 확인하세요.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5ef",
    theme_color: "#dfff3f",
    orientation: "portrait",
    lang: "ko-KR",
    categories: ["utilities", "lifestyle"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
