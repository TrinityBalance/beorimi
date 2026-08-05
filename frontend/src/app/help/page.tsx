import Link from "next/link";
import { PageHeader } from "@/components/page-header";

const faqs = [
  {
    question: "AI 판독 결과는 정확한가요?",
    answer: "사진을 바탕으로 가능성이 높은 후보를 안내합니다. 품목과 규격은 신고 전에 직접 확인하고, 최종 수수료는 강남구 공식 신고 페이지에서 확정해주세요.",
  },
  {
    question: "사진은 어디에 저장되나요?",
    answer: "분석 사진은 사용자별 업로드 공간에 임시 저장되고 보관 기간이 지나면 자동 삭제됩니다. 최근 결과 기록은 사용 중인 기기의 브라우저에 저장되며 기록 화면에서 직접 삭제할 수 있습니다.",
  },
  {
    question: "폐기물이 여러 개 찍혔어요.",
    answer: "영역을 따로 선택하지 않으면 사진 전체에서 물건을 각각 찾아 번호와 목록으로 보여줍니다. 하나만 판별하려면 사진 확인 화면에서 해당 물건을 손가락으로 둘러주세요.",
  },
  {
    question: "크기가 애매하면 어떻게 하나요?",
    answer: "단일 사진만으로 절대 크기를 재기는 어렵습니다. A4 용지나 휴대폰처럼 크기를 아는 물건을 함께 찍고, 결과 화면에서 규격을 다시 선택해주세요.",
  },
];

export default function HelpPage() {
  return (
    <main className="page help-page">
      <PageHeader title="도움말" />

      <section className="help-hero">
        <span className="help-hero__mark" aria-hidden="true">?</span>
        <div>
          <span className="section-kicker">NEED HELP?</span>
          <h1>버리미가<br />도와드릴게요</h1>
        </div>
      </section>

      <section className="photo-guide">
        <div className="result-section__heading">
          <div>
            <span className="section-number">01</span>
            <h2>더 정확하게 찍는 법</h2>
          </div>
        </div>
        <div className="guide-grid">
          <article>
            <span className="guide-visual guide-visual--whole" aria-hidden="true"><i /></span>
            <strong>전체가 보이게</strong>
            <p>물건이 잘리지 않게 찍어요.</p>
          </article>
          <article>
            <span className="guide-visual guide-visual--light" aria-hidden="true"><i /></span>
            <strong>밝은 곳에서</strong>
            <p>모양과 재질이 보이게 해요.</p>
          </article>
          <article>
            <span className="guide-visual guide-visual--scale" aria-hidden="true"><i /></span>
            <strong>크기 비교하기</strong>
            <p>휴대폰 등을 함께 놓아요.</p>
          </article>
        </div>
      </section>

      <section className="faq-section">
        <div className="result-section__heading">
          <div>
            <span className="section-number">02</span>
            <h2>자주 묻는 질문</h2>
          </div>
        </div>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <details key={faq.question} open={index === 0}>
              <summary>{faq.question}<span aria-hidden="true">+</span></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="official-links">
        <a href="https://www.gangnam.go.kr/waste/apply/info.do?mid=ID03_020704" target="_blank" rel="noreferrer">
          <span className="official-links__icon" aria-hidden="true">G</span>
          <span><strong>강남구 공식 배출 안내</strong><small>배출 대상·신청 방법 확인</small></span>
          <span aria-hidden="true">↗</span>
        </a>
        <a href="tel:1522-3833">
          <span className="official-links__icon official-links__icon--phone" aria-hidden="true">☎</span>
          <span><strong>태화용역 1522-3833</strong><small>월~토 09:00~18:00</small></span>
          <span aria-hidden="true">›</span>
        </a>
      </section>

      <Link className="help-camera-link" href="/capture">
        <span className="camera-glyph" aria-hidden="true" />
        궁금한 폐기물 사진 찍기
        <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
