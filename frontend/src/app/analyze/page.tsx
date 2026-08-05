"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPendingPhoto,
  getSelectedRegion,
  saveResult,
} from "@/lib/analysis-store";
import { dataUrlToBlob } from "@/lib/image";
import type { WasteAnalysisResult } from "@/types/analysis";

const stages = [
  { title: "이미지 판독", description: "모양과 재질을 살펴보고 있어요" },
  { title: "강남구 품목 검색", description: "공식 품목표와 비교하고 있어요" },
  { title: "배출 규정 확인", description: "수수료와 배출법을 교차 확인해요" },
];

type ApiResult = Omit<WasteAnalysisResult, "image">;

export default function AnalyzePage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [activeStage, setActiveStage] = useState(0);
  const [error, setError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const runAnalysis = useCallback(async () => {
    const photo = getPendingPhoto();
    const region = getSelectedRegion();

    if (!photo) {
      router.replace("/capture");
      return;
    }

    setPhotoUrl(photo.dataUrl);
    setError("");
    setActiveStage(0);

    const stageTwo = window.setTimeout(() => setActiveStage(1), 700);
    const stageThree = window.setTimeout(() => setActiveStage(2), 1450);

    try {
      const formData = new FormData();
      formData.append("image", dataUrlToBlob(photo.dataUrl), photo.name);
      if (region) formData.append("region", JSON.stringify(region));

      const minimumDelay = new Promise((resolve) => setTimeout(resolve, 2300));
      const request = fetch("/api/analyze", {
        method: "POST",
        body: formData,
      }).then(async (response) => {
        if (!response.ok) {
          const body = (await response.json()) as { message?: string };
          throw new Error(body.message ?? "분석 요청에 실패했어요.");
        }
        return response.json() as Promise<ApiResult>;
      });

      const [result] = await Promise.all([request, minimumDelay]);
      const completed: WasteAnalysisResult = { ...result, image: photo.dataUrl };
      saveResult(completed);
      router.replace(`/result/${completed.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "잠시 후 다시 시도해주세요.");
    } finally {
      window.clearTimeout(stageTwo);
      window.clearTimeout(stageThree);
    }
  }, [router]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runAnalysis();
  }, [runAnalysis]);

  return (
    <main className="page analyze-page">
      <header className="analyze-header">
        <span className="brand brand--light">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>버리미</span>
        </span>
        <span className="secure-chip"><span aria-hidden="true">●</span> 안전하게 분석 중</span>
      </header>

      <section className="analyze-copy">
        <span className="eyebrow eyebrow--dark">AI ANALYSIS</span>
        <h1>사진을 꼼꼼히<br />살펴보고 있어요</h1>
        <p>약 5초 정도 걸려요. 잠시만 기다려주세요.</p>
      </section>

      <div className="scanner-card" aria-hidden="true">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" />
        ) : (
          <span className="scanner-card__placeholder" />
        )}
        <span className="scanner-card__line" />
        <span className="scanner-corner scanner-corner--tl" />
        <span className="scanner-corner scanner-corner--tr" />
        <span className="scanner-corner scanner-corner--bl" />
        <span className="scanner-corner scanner-corner--br" />
      </div>

      <ol className="analysis-stages" aria-label="분석 진행 상태">
        {stages.map((stage, index) => {
          const complete = index < activeStage;
          const active = index === activeStage;

          return (
            <li className={`${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`} key={stage.title}>
              <span className="stage-status" aria-hidden="true">
                {complete ? "✓" : index + 1}
              </span>
              <span className="stage-copy">
                <strong>{stage.title}</strong>
                <small>{stage.description}</small>
              </span>
              {active && !error && <span className="stage-loader" aria-label="진행 중" />}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="analysis-error" role="alert">
          <strong>분석을 마치지 못했어요</strong>
          <p>{error}</p>
          <button type="button" onClick={() => void runAnalysis()}>다시 시도</button>
        </div>
      )}

      <p className="analysis-privacy"><span aria-hidden="true">✓</span> 사진은 판별 목적으로만 사용돼요</p>
    </main>
  );
}
