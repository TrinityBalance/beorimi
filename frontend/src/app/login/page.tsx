"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PrivacyConsent } from "@/components/privacy-consent";
import { createAccount, getAccessToken, signInWithPassword } from "@/lib/auth";

type AuthMode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privacyConsentAccepted, setPrivacyConsentAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const failure = new URLSearchParams(window.location.hash.slice(1)).get("error_description");
    if (failure) {
      setError(failure);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }
    void getAccessToken().then(() => router.replace(getNextPath())).catch(() => undefined);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");
    try {
      if (mode === "sign-in") {
        await signInWithPassword(email.trim(), password);
        router.replace(getNextPath());
        return;
      }
      const result = await createAccount(
        email.trim(),
        password,
        privacyConsentAccepted,
        getNextPath(),
      );
      setPassword("");
      if (result.session) router.replace(getNextPath());
      else {
        setMode("sign-in");
        setNotice("이메일로 보낸 인증 링크를 연 뒤 로그인해줘.");
      }
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  function changeMode(next: AuthMode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setPrivacyConsentAccepted(false);
  }

  return (
    <main className="page auth-page">
      <header className="auth-header">
        <span className="brand"><span className="brand-mark" aria-hidden="true"><span /></span><span>버리미</span></span>
        <span className="secure-chip">🔒 안전한 로그인</span>
      </header>
      <section className="auth-intro"><span className="eyebrow">ACCOUNT</span><h1>{mode === "sign-up" ? "버리미를 시작할까요?" : "사진 분석을 계속해요"}</h1><p>분석 기록은 계정별로 안전하게 분리돼요.</p></section>
      <section className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="계정 메뉴">
          <button className={mode === "sign-in" ? "is-active" : ""} type="button" role="tab" aria-selected={mode === "sign-in"} onClick={() => changeMode("sign-in")}>로그인</button>
          <button className={mode === "sign-up" ? "is-active" : ""} type="button" role="tab" aria-selected={mode === "sign-up"} onClick={() => changeMode("sign-up")}>회원가입</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label><span>이메일</span><input type="email" value={email} autoComplete="email" required placeholder="name@example.com" onChange={(event) => setEmail(event.target.value)} /></label>
          <label><span>비밀번호</span><input type="password" value={password} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required placeholder="8자 이상" onChange={(event) => setPassword(event.target.value)} /></label>
          {mode === "sign-up" && (
            <>
              <p className="auth-hint">이메일 인증 링크를 받은 뒤 로그인할 수 있어요.</p>
              <PrivacyConsent
                inputId="signup-privacy-consent"
                checked={privacyConsentAccepted}
                onChange={setPrivacyConsentAccepted}
              />
            </>
          )}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={pending || (mode === "sign-up" && !privacyConsentAccepted)}>{pending ? "처리 중..." : mode === "sign-up" ? "동의하고 계정 만들기" : "로그인하고 계속하기"}</button>
        </form>
      </section>
    </main>
  );
}

function getNextPath(): string {
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
}

function authErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "로그인을 완료하지 못했어요.";
}
