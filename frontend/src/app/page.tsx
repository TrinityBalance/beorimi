"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PhotoPicker } from "@/components/photo-picker";
import { getHistory } from "@/lib/analysis-store";
import { getResultSummary, isMultiResult } from "@/lib/result";
import type { WasteAnalysisResult } from "@/types/analysis";

export default function Home() {
  const [recent, setRecent] = useState<WasteAnalysisResult | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRecent(getHistory()[0] ?? null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const recentSummary = recent ? getResultSummary(recent) : null;
  const recentCount = recent && isMultiResult(recent) ? recent.items.length : recent ? 1 : 0;

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
        <span className="eyebrow"><span aria-hidden="true" /> 대형폐기물 AI 안내</span>
        <h1 id="home-title">
          이거 <em>어떻게</em>
          <br />
          버려야 할까요?
        </h1>
        <p>
          사진 한 장이면 여러 품목을 찾아
          <br />
          신고할 목록으로 정리해드려요.
        </p>

        <span className="home-feature-badge">
          <span aria-hidden="true">✓</span> 여러 물건도 한 번에 판별
        </span>

        <div className="hero-camera-wrap">
          <span className="home-viewfinder" aria-hidden="true" />
          <span className="home-scan-line" aria-hidden="true" />
          <span className="home-detection-sticker home-detection-sticker--one" aria-hidden="true">
            <span>01</span><strong>의자</strong>
          </span>
          <span className="home-detection-sticker home-detection-sticker--two" aria-hidden="true">
            <span>02</span><strong>소파</strong>
          </span>
          <span className="home-detection-sticker home-detection-sticker--three" aria-hidden="true">
            <span>03</span><strong>수납장</strong>
          </span>
          <PhotoPicker mode="camera" variant="hero" />
          <span className="hero-note">버릴 물건이 모두 보이게 찍어주세요</span>
        </div>
      </section>

      <div className="home-album-card">
        <PhotoPicker mode="album" variant="secondary" />
      </div>

      <section className="recent-section" aria-labelledby="recent-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">나의 판별 기록</span>
            <h2 id="recent-title">최근 조회</h2>
          </div>
          <Link href="/history">전체보기 <span aria-hidden="true">›</span></Link>
        </div>

        {recent && recentSummary ? (
          <Link className="recent-card" href={`/result/${recent.id}`}>
            <div
              className={`recent-card__image ${recent.image ? "" : "image-placeholder"}`}
              style={recent.image ? { backgroundImage: `url(${recent.image})` } : undefined}
              aria-hidden="true"
            >
              <span>{recentCount}</span>
            </div>
            <div className="recent-card__body">
              <span className="recent-card__date">{formatRelativeDate(recent.createdAt)}</span>
              <strong>{recentSummary.title}</strong>
              <span>{recentSummary.description}</span>
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
