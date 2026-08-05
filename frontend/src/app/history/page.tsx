"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { clearHistory, getHistory } from "@/lib/analysis-store";
import { getResultSummary } from "@/lib/result";
import type { WasteAnalysisResult } from "@/types/analysis";

export default function HistoryPage() {
  const [history, setHistory] = useState<WasteAnalysisResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHistory(getHistory());
      setLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function removeAll() {
    if (!window.confirm("이 기기에 저장된 조회 기록을 모두 지울까요?")) return;
    clearHistory();
    setHistory([]);
  }

  return (
    <main className="page history-page">
      <PageHeader
        title="최근 조회 기록"
        action={history.length > 0 ? <button className="header-text-button" onClick={removeAll}>전체 삭제</button> : null}
      />

      <section className="history-intro">
        <span className="section-kicker">MY HISTORY</span>
        <h1>내가 확인한<br />폐기물이에요</h1>
        <p>최근 6개의 판별 결과를 이 기기에만 보관해요.</p>
      </section>

      {!loaded ? (
        <div className="screen-loading" />
      ) : history.length > 0 ? (
        <div className="history-list">
          {history.map((item) => {
            const summary = getResultSummary(item);

            return (
              <Link className="history-card" href={`/result/${item.id}`} key={item.id}>
                <div
                  className={item.image ? "history-card__photo" : "history-card__photo image-placeholder"}
                  style={item.image ? { backgroundImage: `url(${item.image})` } : undefined}
                  aria-hidden="true"
                >
                  <span>{summary.confidence}%</span>
                </div>
                <div className="history-card__body">
                  <small>{formatDate(item.createdAt)}</small>
                  <strong>{summary.title}</strong>
                  <p>{summary.description}</p>
                  <span className="history-source"><span aria-hidden="true">✓</span> {summary.status}</span>
                </div>
                <span className="round-arrow" aria-hidden="true">›</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <section className="history-empty">
          <span className="history-empty__art" aria-hidden="true">
            <span className="camera-glyph" />
          </span>
          <h2>아직 기록이 없어요</h2>
          <p>버리기 어려운 물건을 찍으면<br />판별 결과가 여기에 모여요.</p>
          <Link className="primary-button" href="/capture">첫 사진 찍기 <span aria-hidden="true">→</span></Link>
        </section>
      )}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
