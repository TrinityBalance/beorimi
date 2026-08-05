"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPendingPhoto,
  getSelectedRegion,
  saveResult,
} from "@/lib/analysis-store";
import { cropPhoto, dataUrlToBlob } from "@/lib/image";
import type {
  AnalyzeRouteResponse,
  MultiWasteAnalysisResult,
} from "@/types/analysis";

const stages = [
  { title: "사진 속 물체 찾기", description: "버릴 물건의 위치를 찾고 있어요" },
  { title: "품목 판독", description: "물건마다 종류와 특징을 살펴봐요" },
  { title: "결과 목록 만들기", description: "찾은 물건을 보기 쉽게 정리해요" },
];

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

    setError("");
    setActiveStage(0);

    const stageTwo = window.setTimeout(() => setActiveStage(1), 700);
    const stageThree = window.setTimeout(() => setActiveStage(2), 1450);

    try {
      const analysisPhoto = region ? await cropPhoto(photo, region) : photo;
      setPhotoUrl(analysisPhoto.dataUrl);

      const formData = new FormData();
      formData.append(
        "image",
        dataUrlToBlob(analysisPhoto.dataUrl),
        analysisPhoto.name,
      );

      const minimumDelay = new Promise((resolve) => setTimeout(resolve, 2300));
      const request = fetch("/api/analyze", {
        method: "POST",
        body: formData,
      }).then(async (response) => {
        if (!response.ok) {
          const body = (await response.json()) as { message?: string };
          throw new Error(body.message ?? "분석 요청에 실패했어요.");
        }
        return response.json() as Promise<AnalyzeRouteResponse>;
      });

      const [result] = await Promise.all([request, minimumDelay]);
      if (result.items.length === 0) {
        throw new Error(
          "사진에서 대형 폐기물을 찾지 못했어요. 물건이 크게 보이는 사진으로 다시 시도해주세요.",
        );
      }

      const completed: MultiWasteAnalysisResult = {
        kind: "multi",
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        district: "서울 강남구",
        image: analysisPhoto.dataUrl,
        imageName: analysisPhoto.name,
        imageWidth: analysisPhoto.width,
        imageHeight: analysisPhoto.height,
        region,
        sceneType: result.scene_type,
        items: result.items.map((item) => {
          const catalogItem = result.catalog?.find((entry) => entry.name === item.label);
          const estimatedFee = result.feeEstimates?.[String(item.id)];
          const matchingSize = catalogItem?.sizes.find(
            (size) => size.fee === estimatedFee,
          );

          return {
            ...item,
            selected: true,
            detectedLabel: item.label,
            quantity: 1,
            size: matchingSize?.label ?? catalogItem?.sizes[0]?.label,
            estimatedFee,
            userConfirmed: false,
          };
        }),
        notes: result.notes,
        demo: result.demo,
        catalog: result.catalog,
      };
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
        <h1>사진 속 물건을<br />하나씩 찾고 있어요</h1>
        <p>여러 물건도 각각 나눠서 판별해드릴게요.</p>
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
