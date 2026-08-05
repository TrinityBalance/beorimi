"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPendingPhoto,
  getSelectedRegion,
  saveResult,
} from "@/lib/analysis-store";
import { BackendApiError, uploadAndStartAnalysis } from "@/lib/api";
import { AuthRequiredError, getAccessToken } from "@/lib/auth";
import { DEMO_WASTE_CATALOG } from "@/lib/demo-waste-catalog";
import { cropPhoto, dataUrlToBlob } from "@/lib/image";
import type { AnalysisJobStatus, MultiWasteAnalysisResult } from "@/types/analysis";

const stages = [
  { title: "사진 업로드", description: "사진을 안전하게 전송하고 있어요" },
  { title: "분석 준비", description: "분석 작업을 접수하고 있어요" },
  { title: "품목 판독", description: "물건마다 종류와 특징을 살펴봐요" },
  { title: "결과 정리", description: "찾은 물건을 보기 쉽게 정리해요" },
];

const stageByStatus: Record<AnalysisJobStatus | "uploading", number> = {
  uploading: 0,
  queued: 1,
  processing: 2,
  completed: 3,
  failed: 2,
};

export default function AnalyzePage() {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [error, setError] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  const runAnalysis = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const photo = getPendingPhoto();
    const region = getSelectedRegion();

    if (!photo) {
      router.replace("/capture");
      return;
    }

    setError("");
    setQuotaExhausted(false);
    setActiveStage(0);

    try {
      const analysisPhoto = region ? await cropPhoto(photo, region) : photo;
      setPhotoUrl(analysisPhoto.dataUrl);
      const image = dataUrlToBlob(analysisPhoto.dataUrl);
      const accessToken = await getAccessToken();
      const job = await uploadAndStartAnalysis(
        image,
        analysisPhoto.name,
        accessToken,
        {
          signal: controller.signal,
          onStatus: (status) => setActiveStage(stageByStatus[status]),
        },
      );
      const result = job.observation;
      if (!result) {
        throw new Error("분석 결과를 불러오지 못했어요.");
      }
      if (result.items.length === 0) {
        throw new Error(
          "사진에서 대형 폐기물을 찾지 못했어요. 물건이 크게 보이는 사진으로 다시 시도해주세요.",
        );
      }

      const completed: MultiWasteAnalysisResult = {
        kind: "multi",
        id: job.id,
        createdAt: job.created_at,
        district: "서울 강남구",
        image: analysisPhoto.dataUrl,
        imageName: analysisPhoto.name,
        imageWidth: analysisPhoto.width,
        imageHeight: analysisPhoto.height,
        region,
        sceneType: result.scene_type,
        items: result.items.map((item) => ({
          ...item,
          selected: true,
          detectedLabel: item.label,
          quantity: Math.max(1, item.quantity),
          size: item.fee_size_label ?? (item.longest_side_cm
            ? `최장변 약 ${item.longest_side_cm}cm`
            : undefined),
          estimatedFee: item.estimated_fee ?? undefined,
          userConfirmed: !item.needs_user_confirmation,
        })),
        notes: result.notes,
        catalog: DEMO_WASTE_CATALOG,
      };
      saveResult(completed);
      router.replace(`/result/${completed.id}`);
    } catch (caught) {
      if (isAbortError(caught)) return;
      if (
        caught instanceof AuthRequiredError ||
        (caught instanceof BackendApiError && [401, 403].includes(caught.status))
      ) {
        router.replace("/login?next=/analyze&reason=expired");
        return;
      }
      if (caught instanceof BackendApiError && caught.status === 429) {
        setQuotaExhausted(true);
      }
      setError(
        caught instanceof Error ? caught.message : "잠시 후 다시 시도해주세요.",
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [router]);

  useEffect(() => {
    const start = window.setTimeout(() => void runAnalysis(), 0);
    return () => {
      window.clearTimeout(start);
      abortRef.current?.abort();
    };
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
          <button
            type="button"
            onClick={() => {
              if (quotaExhausted) {
                router.replace("/");
                return;
              }
              void runAnalysis();
            }}
          >
            {quotaExhausted ? "홈으로 돌아가기" : "다시 시도"}
          </button>
        </div>
      )}

      <p className="analysis-privacy"><span aria-hidden="true">✓</span> 사진은 판별 목적으로만 사용돼요</p>
    </main>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
