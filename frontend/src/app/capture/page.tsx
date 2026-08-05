"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PhotoPicker } from "@/components/photo-picker";
import {
  getPendingPhoto,
  getSelectedRegion,
  saveSelectedRegion,
} from "@/lib/analysis-store";
import type { PendingPhoto, SelectionRegion } from "@/types/analysis";

type Point = { x: number; y: number };

export default function CapturePage() {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const drawStart = useRef<Point | null>(null);
  const [photo, setPhoto] = useState<PendingPhoto | null | undefined>(undefined);
  const [region, setRegion] = useState<SelectionRegion | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPhoto(getPendingPhoto());
      setRegion(getSelectedRegion());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function pointFromEvent(event: React.PointerEvent<HTMLDivElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!photo) return;
    const point = pointFromEvent(event);
    drawStart.current = point;
    setRegion({ x: point.x, y: point.y, width: 0, height: 0 });
    setIsDrawing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawStart.current || !isDrawing) return;
    const current = pointFromEvent(event);
    const start = drawStart.current;

    setRegion({
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDrawing) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    drawStart.current = null;
    setIsDrawing(false);

    setRegion((current) => {
      if (!current || current.width < 5 || current.height < 5) return null;
      return current;
    });
  }

  function startAnalysis() {
    if (!photo) return;
    saveSelectedRegion(region);
    router.push("/analyze");
  }

  if (photo === undefined) {
    return (
      <main className="page capture-page">
        <PageHeader title="사진 확인" />
        <div className="screen-loading" aria-label="사진 불러오는 중" />
      </main>
    );
  }

  if (!photo) {
    return (
      <main className="page capture-page">
        <PageHeader title="사진 선택" />
        <section className="empty-photo-state">
          <span className="empty-photo-state__visual" aria-hidden="true">
            <span className="camera-glyph" />
          </span>
          <h2>확인할 사진이 없어요</h2>
          <p>폐기물 전체가 보이도록 새로 찍거나 앨범에서 불러오세요.</p>
          <div className="empty-photo-state__actions">
            <PhotoPicker mode="camera" label="사진 찍기" />
            <PhotoPicker mode="album" label="앨범에서 선택" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page capture-page">
      <PageHeader
        title="사진 확인"
        action={<PhotoPicker mode="album" label="바꾸기" />}
      />

      <section className="capture-intro">
        <span className="step-chip">STEP 1</span>
        <h2>판별할 폐기물을 확인해주세요</h2>
        <p>사진 전체를 사용하면 여러 물건을 한 번에 찾아요. 하나만 보려면 영역을 둘러주세요.</p>
      </section>

      <div
        ref={stageRef}
        className={`selection-stage ${isDrawing ? "is-drawing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="img"
        aria-label="업로드한 사진. 드래그해서 판별 영역을 선택할 수 있습니다."
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.dataUrl} alt="판별할 폐기물 미리보기" draggable={false} />
        <div className="selection-stage__shade" aria-hidden="true" />
        {!region && (
          <div className="selection-hint" aria-hidden="true">
            <span className="selection-corner selection-corner--tl" />
            <span className="selection-corner selection-corner--tr" />
            <span className="selection-corner selection-corner--bl" />
            <span className="selection-corner selection-corner--br" />
            <strong>여러 물건 자동 판별</strong>
            <span>사진 전체를 꼼꼼히 살펴볼게요</span>
          </div>
        )}
        {region && (
          <div
            className="selection-box"
            style={{
              left: `${region.x}%`,
              top: `${region.y}%`,
              width: `${region.width}%`,
              height: `${region.height}%`,
            }}
            aria-hidden="true"
          >
            <span className="selection-box__label">이 물건 판별</span>
            <span className="selection-handle selection-handle--tl" />
            <span className="selection-handle selection-handle--tr" />
            <span className="selection-handle selection-handle--bl" />
            <span className="selection-handle selection-handle--br" />
          </div>
        )}
      </div>

      <div className="selection-actions">
        <button
          className={`choice-chip ${!region ? "is-selected" : ""}`}
          type="button"
          onClick={() => setRegion(null)}
        >
          <span className="check-dot" aria-hidden="true" />
          사진 속 물건 전체 찾기
        </button>
        {region && (
          <button className="text-button" type="button" onClick={() => setRegion(null)}>
            영역 다시 선택
          </button>
        )}
      </div>

      <aside className="photo-tip">
        <span aria-hidden="true">!</span>
        <p><strong>겹치지 않게 찍어주세요</strong> 물건 사이가 조금 떨어져 있으면 각각 더 정확히 찾을 수 있어요.</p>
      </aside>

      <div className="sticky-cta">
        <button className="primary-button" type="button" onClick={startAnalysis}>
          {region ? "선택한 물건 판별하기" : "사진 속 물건 모두 판별하기"}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
