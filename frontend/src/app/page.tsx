"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PhotoPicker } from "@/components/photo-picker";
import { getHistory } from "@/lib/analysis-store";
import type { WasteAnalysisResult } from "@/types/analysis";

export default function Home() {
  const [recent, setRecent] = useState<WasteAnalysisResult | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRecent(getHistory()[0] ?? null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="page home-page">
      <header className="home-header">
        <Link href="/" className="brand" aria-label="버리미 홈">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>버리미</span>
        </Link>
        <span className="district-chip">
          <span className="pin-dot" aria-hidden="true" />
          서울 강남구
        </span>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <span className="eyebrow">대형폐기물 AI 안내</span>
        <h1 id="home-title">
          이거 어떻게
          <br />
          버려야 할까요?
        </h1>
        <p>
          사진 한 장이면 품목부터 수수료,
          <br />
          배출 방법까지 확인해드려요.
        </p>

        <div className="hero-camera-wrap">
          <span className="orbit orbit--one" aria-hidden="true" />
          <span className="orbit orbit--two" aria-hidden="true" />
          <PhotoPicker mode="camera" variant="hero" />
          <span className="hero-note">가운데에 폐기물을 맞춰주세요</span>
        </div>

        <PhotoPicker mode="album" variant="secondary" />
      </section>

      <section className="recent-section" aria-labelledby="recent-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">MY HISTORY</span>
            <h2 id="recent-title">최근 조회</h2>
          </div>
          <Link href="/history">전체보기 <span aria-hidden="true">›</span></Link>
        </div>

        {recent ? (
          <Link className="recent-card" href={`/result/${recent.id}`}>
            <div
              className={`recent-card__image ${recent.image ? "" : "image-placeholder"}`}
              style={recent.image ? { backgroundImage: `url(${recent.image})` } : undefined}
              aria-hidden="true"
            />
            <div className="recent-card__body">
              <span className="recent-card__date">{formatRelativeDate(recent.createdAt)}</span>
              <strong>{recent.primary.name}</strong>
              <span>{recent.primary.fee.toLocaleString("ko-KR")}원 · 신고 필요</span>
            </div>
            <span className="round-arrow" aria-hidden="true">↗</span>
          </Link>
        ) : (
          <div className="empty-recent">
            <span className="empty-recent__icon" aria-hidden="true" />
            <div>
              <strong>아직 조회한 품목이 없어요</strong>
              <p>첫 사진을 찍으면 여기에 기록돼요.</p>
            </div>
          </div>
        )}
      </section>

      <aside className="tip-strip">
        <span className="tip-strip__badge">TIP</span>
        <p>크기가 애매하면 A4 용지나 휴대폰을 옆에 두고 찍어주세요.</p>
      </aside>
    </main>
  );
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return `오늘 ${new Intl.DateTimeFormat("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date)}`;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(date);
}
