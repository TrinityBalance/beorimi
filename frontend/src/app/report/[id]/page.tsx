"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { getResult } from "@/lib/analysis-store";
import {
  getEstimatedFeeTotal,
  getItemEstimatedFee,
  getSelectedItems,
  isMultiResult,
} from "@/lib/result";
import type { WasteAnalysisResult } from "@/types/analysis";

const OFFICIAL_REPORT_URL =
  "https://clean.gangnam.go.kr/use/biwa/USEBIWA02030000.do";
const reportItemColors = ["#dfff3f", "#ff9f6e", "#71d7ff", "#d7a8ff", "#ffd86b"];

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const [result, setResult] = useState<WasteAnalysisResult | null>();
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [copied, setCopied] = useState(false);
  const [itemsConfirmed, setItemsConfirmed] = useState(false);
  const [officialCheckConfirmed, setOfficialCheckConfirmed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setResult(getResult(params.id));
      setItemsConfirmed(false);
      setOfficialCheckConfirmed(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [params.id]);

  async function copySummary() {
    if (!result) return;

    const itemLines = isMultiResult(result)
      ? getSelectedItems(result).map(
          (item, index) =>
            `품목 ${index + 1}: ${item.label}${item.size ? ` · ${item.size}` : ""} · ${Math.max(1, item.quantity ?? 1)}개${
              item.estimatedFee === undefined
                ? ""
                : ` · 데모 예상 ${getItemEstimatedFee(item).toLocaleString("ko-KR")}원`
            }`,
        )
      : [
          `품목: ${result.primary.name}`,
          `예상 수수료: ${result.primary.fee.toLocaleString("ko-KR")}원`,
        ];
    const lines = [
      ...itemLines,
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

  const isMulti = isMultiResult(result);
  const selectedItems = isMulti ? getSelectedItems(result) : [];
  const estimatedTotal = isMulti ? getEstimatedFeeTotal(selectedItems) : null;
  const addressReady = address.trim().length > 0;
  const dateReady = date.length > 0;
  const checklistCompleted = [
    itemsConfirmed,
    officialCheckConfirmed,
  ].filter(Boolean).length;
  const isReportReady = checklistCompleted === 2;

  return (
    <main className="page report-page">
      <PageHeader title="배출 신고 준비" backHref={`/result/${result.id}`} />

      <section className="report-hero">
        <span className="step-chip">신고 전 마지막 단계</span>
        <h1>
          {isMulti ? `${selectedItems.length}개 품목 신고를` : "신고할 정보를"}<br />
          미리 준비해둘게요
        </h1>
        <p>입력한 내용은 서버에 저장되지 않아요.</p>
      </section>

      {isMulti ? (
        <section className="report-multi-list" aria-label="신고 준비 품목">
          {selectedItems.map((item, index) => (
            <article
              style={{
                "--item-color": reportItemColors[index % reportItemColors.length],
                "--item-order": index,
              } as CSSProperties}
              key={item.id}
            >
              <span>{index + 1}</span>
              <div>
                <small>{item.userConfirmed ? "사용자 확인 품목" : "판독한 품목"}</small>
                <strong>
                  {item.label}{item.size ? ` · ${item.size}` : ""} · {Math.max(1, item.quantity ?? 1)}개
                </strong>
              </div>
              <em>
                {item.estimatedFee === undefined
                  ? `${Math.round(item.confidence * 100)}%`
                  : `${result.demo ? "데모 예상 " : "예상 "}${getItemEstimatedFee(item).toLocaleString("ko-KR")}원`}
              </em>
            </article>
          ))}
          <p>
            {estimatedTotal === null
              ? "품목별 규격과 수수료는 공식 신고 페이지에서 최종 확인해주세요."
              : `선택 품목 데모 예상 합계 ${estimatedTotal.toLocaleString("ko-KR")}원 · 공식 신고 페이지에서 최종 확인해주세요.`}
          </p>
        </section>
      ) : (
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
      )}

      <section className="report-form" aria-labelledby="report-form-title">
        <div className="result-section__heading">
          <div>
            <span className="section-number">01</span>
            <h2 id="report-form-title">배출 정보 메모</h2>
          </div>
          <span className="required-chip">선택 입력</span>
        </div>

        <label>
          <span className="report-field-label">
            <span>배출 주소</span>
            <em className={addressReady ? "is-complete" : ""}>
              {addressReady ? "✓ 입력 완료" : "입력하면 자동 확인"}
            </em>
          </span>
          <div className="input-shell">
            <span className="pin-dot" aria-hidden="true" />
            <input
              id="report-address"
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="예: 강남구 테헤란로 123"
              autoComplete="street-address"
            />
          </div>
        </label>

        <label>
          <span className="report-field-label">
            <span>배출 예정일</span>
            <em className={dateReady ? "is-complete" : ""}>
              {dateReady ? "✓ 선택 완료" : "선택하면 자동 확인"}
            </em>
          </span>
          <div className="input-shell">
            <span className="calendar-glyph" aria-hidden="true" />
            <input
              id="report-date"
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

      <section
        className={`report-checklist ${isReportReady ? "is-complete" : ""}`}
        aria-labelledby="report-checklist-title"
      >
        <div className="result-section__heading">
          <div>
            <span className="section-number">02</span>
            <h2 id="report-checklist-title">신고 전 최종 확인</h2>
          </div>
          <span className={`checklist-count ${isReportReady ? "is-complete" : ""}`} aria-live="polite">
            {checklistCompleted}/2 완료
          </span>
        </div>
        <p className="section-description">빠뜨리기 쉬운 내용을 확인하면 공식 신고 페이지로 이동할 수 있어요.</p>

        <div className="checklist-auto-status" aria-label="자동 확인 항목">
          <button
            className={addressReady ? "is-complete" : ""}
            type="button"
            onClick={() => document.querySelector<HTMLInputElement>("#report-address")?.focus()}
          >
            <span aria-hidden="true">{addressReady ? "✓" : "1"}</span>
            <strong>주소</strong>
            <small>{addressReady ? "입력 완료" : "입력 필요"}</small>
          </button>
          <button
            className={dateReady ? "is-complete" : ""}
            type="button"
            onClick={() => document.querySelector<HTMLInputElement>("#report-date")?.focus()}
          >
            <span aria-hidden="true">{dateReady ? "✓" : "2"}</span>
            <strong>예정일</strong>
            <small>{dateReady ? formatKoreanDate(date) : "선택 필요"}</small>
          </button>
        </div>

        <div className="report-checklist__items">
          <label className={itemsConfirmed ? "is-complete" : ""}>
            <input
              type="checkbox"
              checked={itemsConfirmed}
              onChange={(event) => setItemsConfirmed(event.target.checked)}
            />
            <span className="checklist-box" aria-hidden="true">{itemsConfirmed ? "✓" : ""}</span>
            <span>
              <strong>품목·규격·수량을 확인했어요</strong>
              <small>
                {isMulti
                  ? `${selectedItems.length}개 품목${estimatedTotal === null ? "" : ` · 데모 예상 ${estimatedTotal.toLocaleString("ko-KR")}원`}`
                  : `${result.primary.name} · 예상 ${result.primary.fee.toLocaleString("ko-KR")}원`}
              </small>
            </span>
          </label>

          <label className={officialCheckConfirmed ? "is-complete" : ""}>
            <input
              type="checkbox"
              checked={officialCheckConfirmed}
              onChange={(event) => setOfficialCheckConfirmed(event.target.checked)}
            />
            <span className="checklist-box" aria-hidden="true">{officialCheckConfirmed ? "✓" : ""}</span>
            <span>
              <strong>공식 사이트에서 금액을 다시 확인할게요</strong>
              <small>화면의 예상 금액은 참고용이며 최종 금액은 신고 단계에서 확정돼요</small>
            </span>
          </label>
        </div>

        <div className="checklist-progress" aria-hidden="true">
          <span style={{ width: `${checklistCompleted * 50}%` }} />
        </div>

        {isReportReady && (
          <div className="checklist-complete-banner" role="status">
            <span aria-hidden="true">✓</span>
            <p>
              <strong>신고 준비 완료!</strong>
              빠진 내용 없이 모두 확인했어요. 이제 공식 신고 페이지로 이동하면 돼요.
            </p>
            <i aria-hidden="true">✦</i>
          </div>
        )}
      </section>

      <details className="before-report">
        <summary className="result-section__heading">
          <div>
            <span className="section-number">03</span>
            <h2>공식 사이트에서 할 일</h2>
          </div>
          <span className="before-report__toggle">
            <span className="before-report__closed">펼쳐보기</span>
            <span className="before-report__open">접기</span>
            <span className="before-report__arrow" aria-hidden="true">⌄</span>
          </span>
        </summary>
        <ol>
          <li>
            <span>1</span>
            <p>
              {isMulti ? (
                <>품목 검색에서 선택한 <strong>{selectedItems.length}개 품목</strong>을 차례로 찾아요.</>
              ) : (
                <>품목 검색에서 <strong>{result.primary.name}</strong>을 찾아 선택해요.</>
              )}
            </p>
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
      </details>

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
      </div>
      <div className="detail-primary-tray is-ready">
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

function formatKoreanDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}
