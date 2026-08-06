"use client";

import Link from "next/link";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { DEMO_WASTE_CATALOG } from "@/lib/demo-waste-catalog";
import {
  getEstimatedFeeTotal,
  getItemEstimatedFee,
  getSelectedItems,
} from "@/lib/result";
import type {
  BoundingBox,
  DetectedWasteItem,
  MultiWasteAnalysisResult,
  WasteCatalogItem,
} from "@/types/analysis";

const itemColors = ["#dfff3f", "#ff9f6e", "#71d7ff", "#d7a8ff", "#ffd86b"];

type MultiResultViewProps = {
  result: MultiWasteAnalysisResult;
  onChange: (result: MultiWasteAnalysisResult) => void;
};

export function MultiResultView({ result, onChange }: MultiResultViewProps) {
  const [copied, setCopied] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftSize, setDraftSize] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const selectedItems = getSelectedItems(result);
  const reportableItems = result.items.filter(
    (item) => item.bulky_waste_status !== "not_eligible",
  );
  const allSelected = reportableItems.length > 0 &&
    selectedItems.length === reportableItems.length;
  const estimatedTotal = getEstimatedFeeTotal(selectedItems);
  const catalog = result.demo
    ? result.catalog?.length
      ? result.catalog
      : DEMO_WASTE_CATALOG
    : [];
  const editingItem = result.items.find((item) => item.id === editingItemId);
  const selectedCatalogItem = catalog.find((item) => item.name === draftLabel);
  const selectedSizeOption = selectedCatalogItem?.sizes.find(
    (size) => size.label === draftSize,
  );
  const normalizedQuery = catalogQuery.trim().toLocaleLowerCase("ko-KR");
  const filteredCatalog = catalog.filter((item) =>
    item.name.toLocaleLowerCase("ko-KR").includes(normalizedQuery),
  );
  const editingItemIndex = editingItem
    ? result.items.findIndex((item) => item.id === editingItem.id)
    : -1;
  const editingItemColor = itemColors[Math.max(0, editingItemIndex) % itemColors.length];

  useEffect(() => {
    if (editingItemId === null) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setEditingItemId(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [editingItemId]);

  function updateItem(
    id: number,
    update: (item: MultiWasteAnalysisResult["items"][number]) =>
      MultiWasteAnalysisResult["items"][number],
  ) {
    onChange({
      ...result,
      items: result.items.map((item) => (item.id === id ? update(item) : item)),
    });
  }

  function toggleItem(id: number) {
    updateItem(id, (item) => item.bulky_waste_status === "not_eligible"
      ? item
      : { ...item, selected: !item.selected });
  }

  function toggleAll() {
    onChange({
      ...result,
      items: result.items.map((item) => ({
        ...item,
        selected: item.bulky_waste_status === "not_eligible" ? false : !allSelected,
      })),
    });
  }

  async function copySelectedItems() {
    if (selectedItems.length === 0) return;

    try {
      const text = selectedItems
        .map((item, index) => {
          const quantity = Math.max(1, item.quantity ?? 1);
          const size = item.size ? ` · ${item.size}` : "";
          const fee = item.estimatedFee === undefined
            ? ""
            : ` · ${getItemEstimatedFee(item).toLocaleString("ko-KR")}원`;
          return `${index + 1}. ${item.label}${size} · ${quantity}개${fee}`;
        })
        .join("\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function openCorrection(item: DetectedWasteItem) {
    const matchingCatalogItem = catalog.find((entry) => entry.name === item.label);
    setEditingItemId(item.id);
    setCatalogQuery("");
    setDraftLabel(item.label);
    setDraftSize(
      item.size ??
        matchingCatalogItem?.sizes.find((size) => size.fee === item.estimatedFee)?.label ??
        matchingCatalogItem?.sizes[0]?.label ??
        "",
    );
    setDraftQuantity(Math.max(1, item.quantity ?? 1));
    setShowSizeGuide(false);
  }

  function chooseCatalogItem(item: WasteCatalogItem) {
    const nextSize =
      item.sizes.find((size) => size.label === draftSize)?.label ??
      item.sizes[0]?.label ??
      "";
    setDraftLabel(item.name);
    setDraftSize(nextSize);
  }

  function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem || !draftLabel.trim()) return;

    const catalogItem = catalog.find((item) => item.name === draftLabel.trim());
    const sizeOption = catalogItem?.sizes.find((size) => size.label === draftSize);
    const correctedSize = draftSize.trim();
    const correctedLabel = draftLabel.trim();
    const labelChanged = correctedLabel !== editingItem.label;
    const sizeChanged = correctedSize !== (editingItem.size ?? "");
    const preserveOfficialFee = !labelChanged && !sizeChanged;

    updateItem(editingItem.id, (item) => ({
      ...item,
      detectedLabel: item.detectedLabel ?? item.label,
      label: correctedLabel,
      size: correctedSize || undefined,
      quantity: Math.max(1, draftQuantity),
      estimatedFee: sizeOption?.fee ?? (preserveOfficialFee ? item.estimatedFee : undefined),
      estimated_fee: sizeOption?.fee ?? (preserveOfficialFee ? item.estimated_fee : null),
      fee_size_label: correctedSize || null,
      selected: labelChanged && item.bulky_waste_status === "not_eligible"
        ? true
        : item.selected,
      bulky_waste_status: labelChanged
        ? "needs_confirmation"
        : item.bulky_waste_status,
      disposal_notice: labelChanged
        ? "사용자가 품목명을 수정했습니다. 공식 수거대상 목록에서 유사 품목 또는 기타 품목으로 신고 가능한지 확인해주세요."
        : item.disposal_notice,
      disposal_guidance_url: labelChanged
        ? "https://clean.gangnam.go.kr/use/biwa/USEBIWA01000000.do"
        : item.disposal_guidance_url,
      userConfirmed: true,
      needs_user_confirmation: false,
      confirm_question: null,
    }));
    setEditingItemId(null);
  }

  return (
    <main className="page result-page multi-result-page">
      <PageHeader
        title="판별 결과"
        backHref="/"
        action={<span className="result-done">완료</span>}
      />

      <section className="multi-result-hero">
        <span className="eyebrow">여러 품목 판별</span>
        <h1>
          사진에서 <em>{result.items.length}개</em>의<br />
          물건을 찾았어요
        </h1>
        <p>사진 속 번호와 아래 품목을 비교한 뒤, 버릴 물건만 선택해주세요.</p>
      </section>

      <section className="multi-photo-section" aria-label="사진 속 판별된 물건">
        <div
          className="result-photo result-photo--multi"
          style={{ aspectRatio: `${result.imageWidth} / ${result.imageHeight}` }}
        >
          {result.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.image} alt="여러 폐기물 판별 결과" />
          ) : (
            <span className="image-placeholder" aria-hidden="true" />
          )}

          {result.items.map((item, index) =>
            item.bbox ? (
              <button
                type="button"
                className={`detection-box ${item.bulky_waste_status === "not_eligible" ? "is-ineligible" : item.selected ? "is-selected" : "is-excluded"}`}
                style={getBoxStyle(item.bbox, itemColors[index % itemColors.length], index)}
                onClick={() => toggleItem(item.id)}
                disabled={item.bulky_waste_status === "not_eligible"}
                aria-label={item.bulky_waste_status === "not_eligible" ? `${item.label} 대형폐기물 배출 대상 아님` : `${item.label} ${item.selected ? "선택 해제" : "선택"}`}
                key={item.id}
              >
                <span>{index + 1}</span>
              </button>
            ) : null,
          )}

          <span className="result-photo__badge">
            <span aria-hidden="true">✓</span> {result.items.length}개 판독 완료
          </span>
        </div>
      </section>

      {result.sceneType === "unclear" && (
        <aside className="multi-result-warning">
          <span aria-hidden="true">!</span>
          <p><strong>사진이 조금 불명확해요</strong> 품목명을 직접 확인하거나 다시 촬영해주세요.</p>
        </aside>
      )}

      <section className="result-section multi-items-section">
        <div className="result-section__heading">
          <div>
            <span className="section-number">01</span>
            <h2>찾은 품목</h2>
          </div>
          <button className="multi-select-all" type="button" disabled={reportableItems.length === 0} onClick={toggleAll}>
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
        </div>
        <p className="section-description">
          선택한 {selectedItems.length}개 품목만 신고 준비 목록에 담겨요.
        </p>

        <div className="multi-item-list">
          {result.items.map((item, index) => {
            const confidence = toPercent(item.confidence);
            const needsConfirmation =
              item.needs_user_confirmation && !item.userConfirmed;
            const quantity = Math.max(1, item.quantity ?? 1);
            const isNotEligible = item.bulky_waste_status === "not_eligible";

            return (
              <article
                className={`multi-item-card ${isNotEligible ? "is-ineligible" : item.selected ? "is-selected" : "is-excluded"}`}
                style={{
                  "--item-color": itemColors[index % itemColors.length],
                  "--item-order": index,
                } as CSSProperties}
                key={item.id}
              >
                <button
                  className="multi-item-card__toggle"
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  disabled={isNotEligible}
                  aria-pressed={item.selected}
                  aria-label={isNotEligible ? `${item.label} 대형폐기물 배출 대상 아님` : `${item.label} ${item.selected ? "제외" : "선택"}`}
                >
                  {isNotEligible ? "!" : item.selected ? "✓" : ""}
                </button>

                <span
                  className="multi-item-card__number"
                  style={{ "--item-color": itemColors[index % itemColors.length] } as CSSProperties}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>

                <div className="multi-item-card__body">
                  <div className="multi-item-card__title">
                    <div>
                      <strong>{item.label}</strong>
                      {item.userConfirmed && <span>사용자 확인</span>}
                    </div>
                    <button type="button" onClick={() => openCorrection(item)}>수정</button>
                    <strong>{confidence}%</strong>
                  </div>
                  {!isNotEligible && item.estimatedFee !== undefined && (
                    <div className="multi-item-card__fee">
                      <span>
                        {result.demo ? "데모 예상 수수료" : "예상 수수료"}
                        {quantity > 1 ? ` · ${item.estimatedFee.toLocaleString("ko-KR")}원 × ${quantity}` : ""}
                      </span>
                      <strong>{getItemEstimatedFee(item).toLocaleString("ko-KR")}원</strong>
                    </div>
                  )}
                  <div className="multi-confidence-track" aria-label={`AI 신뢰도 ${confidence}%`}>
                    <span style={{ width: `${confidence}%` }} />
                  </div>
                  <div className="multi-item-card__meta">
                    <span>{isNotEligible ? "폐기대상이 아닙니다" : item.userConfirmed ? "사용자가 확인했어요" : needsConfirmation ? "품목 확인 필요" : "가능성 높음"}</span>
                    <small>{[item.size, `${quantity}개`].filter(Boolean).join(" · ")}</small>
                  </div>
                  {isNotEligible && item.disposal_notice && (
                    <details className="multi-item-card__disposal-notice">
                      <summary>[안내]</summary>
                      <p>{item.disposal_notice}</p>
                      {item.disposal_guidance_url && (
                        <a href={item.disposal_guidance_url} target="_blank" rel="noreferrer">
                          강남구 공식 규정 보기 <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </details>
                  )}
                  {needsConfirmation && item.confirm_question && (
                    <p className="multi-item-card__question">{item.confirm_question}</p>
                  )}
                  {item.userConfirmed && item.detectedLabel && item.detectedLabel !== item.label && (
                    <p className="multi-item-card__original">AI 판독: {item.detectedLabel}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {result.notes && (
        <aside className="multi-notes-card">
          <span aria-hidden="true">i</span>
          <p><strong>AI 참고사항</strong>{result.notes}</p>
        </aside>
      )}

      {estimatedTotal !== null ? (
        <section className="multi-fee-summary">
          <header>
            <div>
              <span>{result.demo ? "데모 예상 수수료 영수증" : "예상 수수료 영수증"}</span>
              <small>선택한 {selectedItems.length}개 품목</small>
            </div>
            <em>강남구</em>
          </header>
          <ul>
            {selectedItems.map((item) => {
              const originalIndex = result.items.findIndex((candidate) => candidate.id === item.id);
              const quantity = Math.max(1, item.quantity ?? 1);

              return (
                <li
                  style={{
                    "--item-color": itemColors[Math.max(0, originalIndex) % itemColors.length],
                  } as CSSProperties}
                  key={item.id}
                >
                  <span>
                    <i aria-hidden="true" />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{[item.size, quantity > 1 ? `${quantity}개` : "1개"].filter(Boolean).join(" · ")}</small>
                    </span>
                  </span>
                  <strong>{getItemEstimatedFee(item).toLocaleString("ko-KR")}원</strong>
                </li>
              );
            })}
          </ul>
          <div className="multi-fee-summary__total">
            <span>예상 합계</span>
            <strong>{estimatedTotal.toLocaleString("ko-KR")}<small>원</small></strong>
          </div>
          <p>
            {result.demo ? "데모 금액은 화면 테스트용이며, " : ""}
            최종 수수료는 공식 신고 단계에서 품목과 규격을 확인한 뒤 확정됩니다.
          </p>
        </section>
      ) : (
        <section className="multi-policy-pending">
          <span className="multi-policy-pending__mark" aria-hidden="true">G</span>
          <div>
            <strong>수수료는 공식 신고 단계에서 확인해주세요</strong>
            <p>현재는 사진 속 품목을 분리해 목록으로 만들었어요. 강남구 품목·규격별 금액은 공식 사이트에서 최종 확정됩니다.</p>
          </div>
        </section>
      )}

      <div className="result-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => void copySelectedItems()}
          disabled={selectedItems.length === 0}
        >
          <span className="copy-glyph" aria-hidden="true" />
          {copied ? "품목 목록을 복사했어요" : "선택한 품목명 복사"}
        </button>
      </div>

      <div className="detail-primary-tray">
        {selectedItems.length > 0 ? (
          <Link className="primary-button" href={`/report/${result.id}`}>
            선택한 {selectedItems.length}개 품목 신고 준비 <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <button className="primary-button" type="button" disabled>
            신고할 품목을 선택해주세요
          </button>
        )}
      </div>

      {editingItem && (
        <>
          <button
            className="correction-sheet-backdrop"
            type="button"
            aria-label="품목 수정 닫기"
            onClick={() => setEditingItemId(null)}
          />
          <section
            className="correction-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="correction-sheet-title"
          >
            <div className="correction-sheet__handle" aria-hidden="true" />
            <header className="correction-sheet__header">
              <div>
                <div className="correction-sheet__kicker">
                  <span
                    className="correction-item-sticker"
                    style={{ "--item-color": editingItemColor } as CSSProperties}
                  >
                    사진 속 {editingItemIndex + 1}번
                  </span>
                  <span>사용자 확인</span>
                </div>
                <h2 id="correction-sheet-title">품목과 규격 수정</h2>
              </div>
              <button type="button" onClick={() => setEditingItemId(null)} aria-label="닫기">×</button>
            </header>

            <div className="correction-ai-original">
              <span>AI 원본 판독</span>
              <strong>{editingItem.detectedLabel ?? editingItem.label}</strong>
              <em>{toPercent(editingItem.confidence)}%</em>
            </div>

            <form onSubmit={saveCorrection}>
              {catalog.length > 0 && (
                <div className="correction-field">
                  <label htmlFor="catalog-search">품목 검색</label>
                  <input
                    id="catalog-search"
                    type="search"
                    value={catalogQuery}
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    placeholder="예: 소파, 의자, 수납장"
                    autoFocus
                  />
                  <div className="correction-catalog" role="listbox" aria-label="품목 후보">
                    {filteredCatalog.map((item) => (
                      <button
                        type="button"
                        className={item.name === draftLabel ? "is-selected" : ""}
                        onClick={() => chooseCatalogItem(item)}
                        aria-selected={item.name === draftLabel}
                        role="option"
                        key={item.name}
                      >
                        <span>{item.name}</span>
                        <small>{item.sizes[0]?.fee.toLocaleString("ko-KR")}원부터</small>
                      </button>
                    ))}
                    {filteredCatalog.length === 0 && <p>검색 결과가 없어요. 아래에 직접 입력해주세요.</p>}
                  </div>
                  {filteredCatalog.length > 3 && (
                    <p className="correction-catalog-hint" aria-hidden="true">옆으로 밀어 더 보기 →</p>
                  )}
                </div>
              )}

              <div className="correction-field">
                <label htmlFor="corrected-label">확정할 품목명</label>
                <input
                  id="corrected-label"
                  value={draftLabel}
                  onChange={(event) => {
                    setDraftLabel(event.target.value);
                    setDraftSize("");
                  }}
                  placeholder="품목명을 입력해주세요"
                  required
                />
              </div>

              {selectedCatalogItem && selectedCatalogItem.sizes.length > 0 && (
                <div className="correction-field correction-sizes">
                  <div className="correction-field__heading">
                    <span id="correction-size-label">추천 규격</span>
                    <button
                      className={showSizeGuide ? "is-open" : ""}
                      type="button"
                      onClick={() => setShowSizeGuide((isOpen) => !isOpen)}
                      aria-expanded={showSizeGuide}
                      aria-controls="correction-size-guide"
                    >
                      <span className="ruler-glyph" aria-hidden="true" />
                      {showSizeGuide ? "도우미 닫기" : "선택 기준 보기"}
                    </button>
                  </div>

                  {showSizeGuide && (
                    <aside className="size-guide-panel" id="correction-size-guide">
                      <div>
                        <span className="size-guide-panel__icon" aria-hidden="true">↔</span>
                        <p>
                          <strong>{selectedCatalogItem.name} 규격 선택 기준</strong>
                          {selectedCatalogItem.sizeGuide ?? "가장 긴 면과 실제 사용 형태를 기준으로 비교해주세요."}
                        </p>
                      </div>
                      <ul>
                        {selectedCatalogItem.sizes.map((size) => (
                          <li key={size.label}>
                            <strong>{size.label}</strong>
                            <span>{size.guide ?? "품목의 실제 크기와 형태를 확인해주세요."}</span>
                          </li>
                        ))}
                      </ul>
                      <small>사진 속 원근 때문에 실제 크기와 다를 수 있어요. 최종 규격은 공식 신고 단계에서 다시 확인해주세요.</small>
                    </aside>
                  )}

                  <div role="radiogroup" aria-labelledby="correction-size-label">
                    {selectedCatalogItem.sizes.map((size) => (
                      <button
                        type="button"
                        role="radio"
                        className={size.label === draftSize ? "is-selected" : ""}
                        onClick={() => setDraftSize(size.label)}
                        aria-checked={size.label === draftSize}
                        key={size.label}
                      >
                        <strong>{size.label}</strong>
                        <small>{size.fee.toLocaleString("ko-KR")}원</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="correction-field">
                <label htmlFor="corrected-size">크기·규격 직접 수정</label>
                <input
                  id="corrected-size"
                  value={draftSize}
                  maxLength={50}
                  onChange={(event) => setDraftSize(event.target.value)}
                  placeholder="예: 가로 120cm, 대형, 2~3인용"
                  aria-describedby="corrected-size-hint"
                />
                <small className="correction-field__hint" id="corrected-size-hint">
                  추천 규격을 고른 뒤 문구를 직접 다듬어도 돼요. 직접 입력하면 금액은 공식 신고 단계에서 확인해주세요.
                </small>
              </div>

              <div className="correction-field correction-quantity">
                <span>수량</span>
                <div>
                  <button
                    type="button"
                    onClick={() => setDraftQuantity((quantity) => Math.max(1, quantity - 1))}
                    disabled={draftQuantity <= 1}
                    aria-label="수량 줄이기"
                  >−</button>
                  <strong>{draftQuantity}<small>개</small></strong>
                  <button
                    type="button"
                    onClick={() => setDraftQuantity((quantity) => Math.min(20, quantity + 1))}
                    disabled={draftQuantity >= 20}
                    aria-label="수량 늘리기"
                  >+</button>
                </div>
              </div>

              <div className="correction-fee-preview">
                <span>{result.demo ? "데모 예상 금액" : "예상 금액"}</span>
                <strong>
                  {selectedSizeOption
                    ? `${(selectedSizeOption.fee * draftQuantity).toLocaleString("ko-KR")}원`
                    : "공식 확인 필요"}
                </strong>
                <small>AI 신뢰도는 원본 그대로 보관되며 사용자가 수정할 수 없어요.</small>
              </div>

              <button className="primary-button correction-save" type="submit">
                이 내용으로 수정하기
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

function toPercent(confidence: number) {
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
}

function getBoxStyle(bbox: BoundingBox, color: string, index: number): CSSProperties {
  const [rawLeft, rawTop, rawRight, rawBottom] = bbox;
  const left = clampCoordinate(Math.min(rawLeft, rawRight));
  const top = clampCoordinate(Math.min(rawTop, rawBottom));
  const right = clampCoordinate(Math.max(rawLeft, rawRight));
  const bottom = clampCoordinate(Math.max(rawTop, rawBottom));

  return {
    "--box-color": color,
    "--item-order": index,
    left: `${left / 10}%`,
    top: `${top / 10}%`,
    width: `${Math.max(0, right - left) / 10}%`,
    height: `${Math.max(0, bottom - top) / 10}%`,
  } as CSSProperties;
}

function clampCoordinate(coordinate: number) {
  return Math.max(0, Math.min(1000, coordinate));
}
