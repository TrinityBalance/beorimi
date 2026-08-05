"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { getResult } from "@/lib/analysis-store";
import type { WasteAnalysisResult } from "@/types/analysis";

const OFFICIAL_REPORT_URL =
  "https://clean.gangnam.go.kr/use/biwa/USEBIWA02030000.do";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const [result, setResult] = useState<WasteAnalysisResult | null>();
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setResult(getResult(params.id));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [params.id]);

  async function copySummary() {
    if (!result) return;

    const lines = [
      `품목: ${result.primary.name}`,
      `예상 수수료: ${result.primary.fee.toLocaleString("ko-KR")}원`,
      address ? `배출 주소: ${address}` : "",
      date ? `배출 예정일: ${date}` : "",
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (result === undefined) {
    return (
      <main className="page report-page">
        <PageHeader title="배출 신고 준비" backHref={`/result/${params.id}`} />
        <div className="screen-loading" />
      </main>
    );
  }

  if (!result) {
    return (
      <main className="page report-page">
        <PageHeader title="배출 신고 준비" />
        <section className="missing-result">
          <span aria-hidden="true">?</span>
          <h2>신고할 판별 결과가 없어요</h2>
          <Link className="primary-button" href="/capture">사진 판별하기</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page report-page">
      <PageHeader title="배출 신고 준비" backHref={`/result/${result.id}`} />

      <section className="report-hero">
        <span className="step-chip">LAST STEP</span>
        <h1>신고할 정보를<br />미리 준비해둘게요</h1>
        <p>입력한 내용은 서버에 저장되지 않아요.</p>
      </section>

      <section className="report-item-card">
        <div
          className={result.image ? "" : "image-placeholder"}
          style={result.image ? { backgroundImage: `url(${result.image})` } : undefined}
          aria-hidden="true"
        />
        <span>
          <small>판독한 품목</small>
          <strong>{result.primary.name}</strong>
          <em>예상 {result.primary.fee.toLocaleString("ko-KR")}원</em>
        </span>
        <button type="button" onClick={() => void copySummary()} aria-label="품목 정보 복사">
          <span className="copy-glyph" aria-hidden="true" />
        </button>
      </section>

      <section className="report-form" aria-labelledby="report-form-title">
        <div className="result-section__heading">
          <div>
            <span className="section-number">01</span>
            <h2 id="report-form-title">배출 정보 메모</h2>
          </div>
          <span className="optional-chip">선택</span>
        </div>

        <label>
          <span>배출 주소</span>
          <div className="input-shell">
            <span className="pin-dot" aria-hidden="true" />
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="예: 강남구 테헤란로 123"
              autoComplete="street-address"
            />
          </div>
        </label>

        <label>
          <span>배출 예정일</span>
          <div className="input-shell">
            <span className="calendar-glyph" aria-hidden="true" />
            <input
              type="date"
              value={date}
              min={tomorrow()}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </label>

        <p className="form-helper">
          <span aria-hidden="true">i</span>
          강남구는 배출 3일 전까지 사전 신고를 안내하고 있어요.
        </p>
      </section>

      <section className="before-report">
        <div className="result-section__heading">
          <div>
            <span className="section-number">02</span>
            <h2>공식 사이트에서 할 일</h2>
          </div>
        </div>
        <ol>
          <li>
            <span>1</span>
            <p>품목 검색에서 <strong>{result.primary.name}</strong>을 찾아 선택해요.</p>
          </li>
          <li>
            <span>2</span>
            <p>배출 주소와 예정일을 공식 신고서에 입력해요.</p>
          </li>
          <li>
            <span>3</span>
            <p>결제 후 접수번호와 연락처를 폐기물에 적어 붙여요.</p>
          </li>
        </ol>
      </section>

      <aside className="official-notice">
        <span className="official-notice__mark" aria-hidden="true">G</span>
        <p>
          <strong>강남구 공식 자원순환 종합포털</strong>
          외부 사이트에서 본인 확인과 결제가 진행됩니다.
        </p>
      </aside>

      <div className="report-actions">
        <button className="secondary-button" type="button" onClick={() => void copySummary()}>
          <span className="copy-glyph" aria-hidden="true" />
          {copied ? "신고 정보를 복사했어요" : "신고 정보 복사하기"}
        </button>
        <a
          className="primary-button"
          href={OFFICIAL_REPORT_URL}
          target="_blank"
          rel="noreferrer"
        >
          공식 신고 페이지로 이동 <span aria-hidden="true">↗</span>
        </a>
      </div>
    </main>
  );
}

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
