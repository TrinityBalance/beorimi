"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MultiResultView } from "@/components/multi-result-view";
import { PageHeader } from "@/components/page-header";
import { getResult, saveResult } from "@/lib/analysis-store";
import { isLegacyResult, isMultiResult } from "@/lib/result";
import type {
  MultiWasteAnalysisResult,
  WasteAnalysisResult,
  WasteCandidate,
} from "@/types/analysis";

const sofaSizes = [
  { size: "1인용", fee: 3000, guide: "한 사람이 앉는 소파 또는 안락의자 크기" },
  { size: "2~3인용", fee: 8000, guide: "성인 두세 명이 나란히 앉는 일반 소파" },
  { size: "4인용 이상", fee: 12000, guide: "네 명 이상이 앉거나 코너가 이어진 대형 소파" },
];

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const candidatesRef = useRef<HTMLElement>(null);
  const [result, setResult] = useState<WasteAnalysisResult | null>();
  const [selected, setSelected] = useState<WasteCandidate | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = getResult(params.id);
      setResult(stored);
      setSelected(stored && isLegacyResult(stored) ? stored.primary : null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [params.id]);

  function chooseCandidate(candidate: WasteCandidate) {
    if (!result || !isLegacyResult(result)) return;

    const updated = { ...result, primary: candidate };
    setSelected(candidate);
    setResult(updated);
    saveResult(updated);
    setShowCandidates(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseSize(size: string, fee: number) {
    if (!result || !isLegacyResult(result) || !selected) return;

    const next = { ...selected, name: `${size} 소파`, size, fee };
    const updated = { ...result, primary: next };
    setSelected(next);
    setResult(updated);
    saveResult(updated);
  }

  async function copyItemName() {
    if (!selected) return;

    try {
      await navigator.clipboard.writeText(selected.name);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (result === undefined) {
    return (
      <main className="page result-page">
        <PageHeader title="판별 결과" />
        <div className="screen-loading" />
      </main>
    );
  }

  if (!result) {
    return (
      <main className="page result-page">
        <PageHeader title="판별 결과" />
        <section className="missing-result">
          <span aria-hidden="true">?</span>
          <h2>결과를 찾을 수 없어요</h2>
          <p>최근 기록에서 다시 찾거나 새 사진을 판별해주세요.</p>
          <Link className="primary-button" href="/capture">새로 판별하기</Link>
        </section>
      </main>
    );
  }

  if (isMultiResult(result)) {
    return (
      <MultiResultView
        result={result}
        onChange={(updated: MultiWasteAnalysisResult) => {
          setResult(updated);
          saveResult(updated);
        }}
      />
    );
  }

  if (!selected) {
    return (
      <main className="page result-page">
        <PageHeader title="판별 결과" />
        <section className="missing-result">
          <span aria-hidden="true">?</span>
          <h2>선택한 품목을 찾을 수 없어요</h2>
          <Link className="primary-button" href="/capture">새로 판별하기</Link>
        </section>
      </main>
    );
  }

  const isSofa = selected.name.includes("소파") && !selected.name.includes("소파베드");
  const candidates = [result.primary, ...result.candidates].filter(
    (candidate, index, array) =>
      array.findIndex((item) => item.name === candidate.name) === index,
  );

  return (
    <main className="page result-page">
      <PageHeader
        title="판별 결과"
        backHref="/"
        action={<span className="result-done">완료</span>}
      />

      {result.demo && (
        <div className="demo-banner">
          <span>DEMO</span>
          실제 AI 연결 전 화면용 예시 결과예요.
        </div>
      )}

      <section className="result-hero">
        <div className="result-photo">
          {result.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.image} alt="판별한 폐기물" />
          ) : (
            <span className="image-placeholder" aria-hidden="true" />
          )}
          <span className="result-photo__badge">
            <span aria-hidden="true">✓</span> 판독 완료
          </span>
        </div>

        <div className="result-title-row">
          <div>
            <span className="result-overline">가장 가능성이 높아요</span>
            <h1>{selected.name}</h1>
          </div>
          <div
            className="confidence-ring"
            style={{ "--confidence": selected.confidence } as React.CSSProperties}
          >
            <strong>{selected.confidence}%</strong>
            <span>AI 신뢰도</span>
          </div>
        </div>

        <button
          className="reselect-button"
          type="button"
          onClick={() => {
            setShowCandidates(true);
            window.setTimeout(
              () => candidatesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
              50,
            );
          }}
        >
          이 품목이 아닌가요? <strong>다시 선택하기</strong>{" "}
          <span aria-hidden="true">›</span>
        </button>
      </section>

      {isSofa && (
        <section className="result-section size-section">
          <div className="result-section__heading">
            <div>
              <span className="section-number">01</span>
              <h2>크기를 확인해주세요</h2>
            </div>
            <span className="required-chip">필수 확인</span>
          </div>
          <p className="section-description">사진만으로 정확한 크기는 알기 어려워요.</p>
          <button
            className={`size-helper-toggle ${showSizeGuide ? "is-open" : ""}`}
            type="button"
            onClick={() => setShowSizeGuide((isOpen) => !isOpen)}
            aria-expanded={showSizeGuide}
            aria-controls="legacy-size-guide"
          >
            <span className="ruler-glyph" aria-hidden="true" />
            {showSizeGuide ? "규격 도우미 닫기" : "어떤 규격인지 모르겠어요"}
            <span aria-hidden="true">⌄</span>
          </button>
          {showSizeGuide && (
            <aside className="size-guide-panel size-guide-panel--legacy" id="legacy-size-guide">
              <div>
                <span className="size-guide-panel__icon" aria-hidden="true">↔</span>
                <p>
                  <strong>실제로 앉을 수 있는 좌석 수를 확인하세요</strong>
                  쿠션 개수보다 성인이 나란히 앉을 수 있는 자리를 기준으로 비교하면 쉬워요.
                </p>
              </div>
              <ul>
                {sofaSizes.map((option) => (
                  <li key={option.size}>
                    <strong>{option.size}</strong>
                    <span>{option.guide}</span>
                  </li>
                ))}
              </ul>
              <small>분리형·코너형 소파는 조각별 신고 여부를 공식 신고 단계에서 다시 확인해주세요.</small>
            </aside>
          )}
          <div className="size-options" role="radiogroup" aria-label="소파 크기">
            {sofaSizes.map((option) => (
              <button
                type="button"
                role="radio"
                aria-checked={selected.size === option.size}
                className={selected.size === option.size ? "is-selected" : ""}
                onClick={() => chooseSize(option.size, option.fee)}
                key={option.size}
              >
                <span className="radio-dot" aria-hidden="true" />
                <strong>{option.size}</strong>
                <small>{option.fee.toLocaleString("ko-KR")}원</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="fee-card">
        <div>
          <span className="fee-card__label">예상 배출 수수료</span>
          <strong>{selected.fee.toLocaleString("ko-KR")}<small>원</small></strong>
        </div>
        <span className="report-status"><span aria-hidden="true">✓</span> 배출 신고 필요</span>
        <p>최종 금액은 공식 신고 단계에서 품목과 규격을 다시 확인한 뒤 확정됩니다.</p>
      </section>

      <section className="result-section disposal-section">
        <div className="result-section__heading">
          <div>
            <span className="section-number">02</span>
            <h2>이렇게 배출하세요</h2>
          </div>
        </div>
        <p className="section-description">{result.disposal.summary}</p>
        <ol className="disposal-steps">
          {result.disposal.steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <div className="caution-box">
          <strong><span aria-hidden="true">!</span> 꼭 확인해주세요</strong>
          <ul>
            {result.disposal.cautions.map((caution) => <li key={caution}>{caution}</li>)}
          </ul>
        </div>
      </section>

      <section
        className={`result-section candidate-section ${showCandidates ? "is-open" : ""}`}
        ref={candidatesRef}
      >
        <div className="result-section__heading">
          <div>
            <span className="section-number">03</span>
            <h2>비슷한 품목 후보</h2>
          </div>
        </div>
        <p className="section-description">
          AI가 함께 확인한 후보예요. 더 맞는 품목을 직접 고를 수 있어요.
        </p>
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <button
              type="button"
              className={candidate.name === selected.name ? "is-selected" : ""}
              onClick={() => chooseCandidate(candidate)}
              key={candidate.name}
            >
              <span className="candidate-check" aria-hidden="true">
                {candidate.name === selected.name ? "✓" : ""}
              </span>
              <span>
                <strong>{candidate.name}</strong>
                <small>{candidate.size} · {candidate.fee.toLocaleString("ko-KR")}원</small>
              </span>
              <em>{candidate.confidence}%</em>
            </button>
          ))}
        </div>
      </section>

      <a className="source-card" href={result.source.url} target="_blank" rel="noreferrer">
        <span className="source-card__icon" aria-hidden="true">i</span>
        <span>
          <strong>공식 자료를 확인했어요</strong>
          <small>{result.source.label} · {result.source.checkedAt}</small>
        </span>
        <span aria-hidden="true">↗</span>
      </a>

      <div className="result-actions">
        <Link className="primary-button" href={`/report/${result.id}`}>
          강남구에 배출 신고하기 <span aria-hidden="true">↗</span>
        </Link>
        <button className="secondary-button" type="button" onClick={() => void copyItemName()}>
          <span className="copy-glyph" aria-hidden="true" />
          {copied ? "품목명을 복사했어요" : "판독한 품목명 복사"}
        </button>
      </div>
    </main>
  );
}
