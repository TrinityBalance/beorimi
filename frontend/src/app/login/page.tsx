"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmAccount,
  createAccount,
  getAccessToken,
  setNewPassword,
  signInWithPassword,
} from "@/lib/auth";

type AuthMode = "sign-in" | "sign-up" | "confirm" | "new-password";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const checkSession = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") === "expired") {
        setNotice("분석을 계속하려면 로그인해주세요.");
      }

      getAccessToken()
        .then(() => router.replace(getNextPath()))
        .catch(() => undefined);
    }, 0);

    return () => window.clearTimeout(checkSession);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");

    try {
      if (mode === "sign-in") {
        const result = await signInWithPassword(email.trim(), password);
        if (result.isSignedIn || result.nextStep.signInStep === "DONE") {
          router.replace(getNextPath());
          return;
        }
        if (
          result.nextStep.signInStep ===
          "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
        ) {
          setPassword("");
          setMode("new-password");
          setNotice("임시 비밀번호를 새 비밀번호로 바꿔주세요.");
          return;
        }
        if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
          setPassword("");
          setMode("confirm");
          setNotice("이메일로 받은 인증 코드를 입력해주세요.");
          return;
        }
        throw new Error("추가 인증이 필요한 계정이에요. 관리자에게 문의해주세요.");
      }

      if (mode === "sign-up") {
        const result = await createAccount(email.trim(), password);
        if (result.isSignUpComplete) {
          setMode("sign-in");
          setPassword("");
          setNotice("가입이 완료됐어요. 로그인해주세요.");
          return;
        }
        setMode("confirm");
        setPassword("");
        setNotice("이메일로 받은 인증 코드를 입력해주세요.");
        return;
      }

      if (mode === "confirm") {
        await confirmAccount(email.trim(), confirmationCode.trim());
        setMode("sign-in");
        setConfirmationCode("");
        setNotice("이메일 인증이 완료됐어요. 로그인해주세요.");
        return;
      }

      const result = await setNewPassword(password);
      if (!result.isSignedIn && result.nextStep.signInStep !== "DONE") {
        throw new Error("새 비밀번호 설정을 완료하지 못했어요.");
      }
      router.replace(getNextPath());
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  function switchMode(nextMode: "sign-in" | "sign-up") {
    setMode(nextMode);
    setPassword("");
    setConfirmationCode("");
    setError("");
    setNotice("");
  }

  const isConfirmation = mode === "confirm";
  const isNewPassword = mode === "new-password";

  return (
    <main className="page auth-page">
      <header className="auth-header">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>버리미</span>
        </span>
        <span className="secure-chip"><span aria-hidden="true">●</span> 안전한 로그인</span>
      </header>

      <section className="auth-intro">
        <span className="eyebrow">ACCOUNT</span>
        <h1>
          {mode === "sign-up"
            ? "버리미를 시작해볼까요?"
            : isConfirmation
              ? "이메일을 확인해주세요"
              : isNewPassword
                ? "새 비밀번호를 정해주세요"
                : "사진 분석을 계속해요"}
        </h1>
        <p>분석 기록은 Cognito 계정별로 안전하게 분리돼요.</p>
      </section>

      <section className="auth-card">
        {!isConfirmation && !isNewPassword && (
          <div className="auth-tabs" role="tablist" aria-label="계정 메뉴">
            <button
              className={mode === "sign-in" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={mode === "sign-in"}
              onClick={() => switchMode("sign-in")}
            >
              로그인
            </button>
            <button
              className={mode === "sign-up" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={mode === "sign-up"}
              onClick={() => switchMode("sign-up")}
            >
              회원가입
            </button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isNewPassword && (
            <label>
              <span>이메일</span>
              <input
                type="email"
                value={email}
                autoComplete="email"
                required
                readOnly={isConfirmation}
                placeholder="name@example.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}

          {isConfirmation ? (
            <label>
              <span>인증 코드</span>
              <input
                type="text"
                value={confirmationCode}
                autoComplete="one-time-code"
                inputMode="numeric"
                required
                placeholder="6자리 코드"
                onChange={(event) => setConfirmationCode(event.target.value)}
              />
            </label>
          ) : (
            <label>
              <span>{isNewPassword ? "새 비밀번호" : "비밀번호"}</span>
              <input
                type="password"
                value={password}
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                minLength={8}
                required
                placeholder="8자 이상"
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}

          {(mode === "sign-up" || isNewPassword) && (
            <p className="auth-hint">영문 대·소문자와 숫자를 포함해 8자 이상 입력해주세요.</p>
          )}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="primary-button" type="submit" disabled={pending}>
            {pending
              ? "처리 중..."
              : isConfirmation
                ? "이메일 인증하기"
                : isNewPassword
                  ? "비밀번호 변경하기"
                  : mode === "sign-up"
                    ? "계정 만들기"
                    : "로그인하고 계속하기"}
          </button>
        </form>

        {(isConfirmation || isNewPassword) && (
          <button
            className="auth-back"
            type="button"
            onClick={() => switchMode("sign-in")}
          >
            로그인으로 돌아가기
          </button>
        )}
      </section>
    </main>
  );
}

function getNextPath(): string {
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested?.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/";
}

function authErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "로그인을 완료하지 못했어요.";

  const messages: Record<string, string> = {
    NotAuthorizedException: "이메일 또는 비밀번호가 올바르지 않아요.",
    UserNotFoundException: "이메일 또는 비밀번호가 올바르지 않아요.",
    UsernameExistsException: "이미 가입된 이메일이에요. 로그인해주세요.",
    CodeMismatchException: "인증 코드가 올바르지 않아요.",
    ExpiredCodeException: "인증 코드가 만료됐어요. 새 코드를 요청해주세요.",
    InvalidPasswordException: "비밀번호 조건을 확인해주세요.",
    LimitExceededException: "요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
  };

  return messages[error.name] ?? error.message;
}
