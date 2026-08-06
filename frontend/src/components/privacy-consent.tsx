type PrivacyConsentProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  inputId: string;
};

export function PrivacyConsent({ checked, onChange, inputId }: PrivacyConsentProps) {
  return (
    <section className="privacy-consent" aria-labelledby={`${inputId}-title`}>
      <label className="privacy-consent__check" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          required
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <strong id={`${inputId}-title`}>[필수] 개인정보 수집·이용 동의</strong>
          <small>계정 이용과 사진 분석에 필요한 정보만 사용해요.</small>
        </span>
      </label>
      <details className="privacy-consent__details">
        <summary>수집·이용 내용 보기</summary>
        <dl>
          <div><dt>수집 정보</dt><dd>이메일, 업로드한 사진, AI 분석 결과</dd></div>
          <div><dt>이용 목적</dt><dd>회원 인증, 폐기물 사진 판독 및 결과 제공</dd></div>
          <div><dt>보관 기간</dt><dd>이메일은 탈퇴 시까지, 사진과 서버 분석 결과는 최대 30일</dd></div>
        </dl>
        <p>사진은 판독을 위해 AI 분석 서비스에 전달됩니다. 동의를 거부할 수 있지만 사진 분석 기능은 이용할 수 없습니다.</p>
      </details>
    </section>
  );
}
