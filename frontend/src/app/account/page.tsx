"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { clearAllAnalysisData } from "@/lib/analysis-store";
import {
  AuthRequiredError,
  deleteCurrentAccount,
  getCurrentUser,
  signOutCurrentUser,
} from "@/lib/auth";
import { hasPrivacyConsent } from "@/lib/privacy-consent";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [privacyConsentRecorded, setPrivacyConsentRecorded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getCurrentUser()
      .then((user) => {
        setEmail(user.email ?? "이메일 계정");
        setPrivacyConsentRecorded(hasPrivacyConsent(user));
      })
      .catch((caught) => {
        if (caught instanceof AuthRequiredError) {
          router.replace("/login?next=/account");
          return;
        }
        setError("계정 정보를 불러오지 못했어요.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSignOut() {
    setPending(true);
    setError("");
    try {
      await signOutCurrentUser();
      router.replace("/login");
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해주세요.");
      setPending(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deletionConfirmed || pending) return;
    setPending(true);
    setError("");
    try {
      await deleteCurrentAccount();
      clearAllAnalysisData();
      router.replace("/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "회원탈퇴를 완료하지 못했어요.");
      setPending(false);
    }
  }

  return (
    <main className="page account-page">
      <PageHeader title="계정 관리" />

      <section className="account-hero">
        <span className="eyebrow">MY ACCOUNT</span>
        <h1>내 정보와 이용 기록을<br />직접 관리해요</h1>
      </section>

      <section className="account-card" aria-busy={loading}>
        <span className="account-avatar" aria-hidden="true" />
        <div>
          <small>로그인 계정</small>
          <strong>{loading ? "불러오는 중..." : email}</strong>
          <span>
            <i aria-hidden="true">{privacyConsentRecorded ? "✓" : "!"}</i>
            {privacyConsentRecorded ? "개인정보 이용 동의 완료" : "사진 분석 시 동의가 필요해요"}
          </span>
        </div>
      </section>

      <section className="account-actions">
        <button className="secondary-button" type="button" disabled={pending || loading} onClick={() => void handleSignOut()}>
          로그아웃
        </button>
      </section>

      <section className="account-danger">
        <span className="section-kicker">DANGER ZONE</span>
        <h2>회원탈퇴</h2>
        <p>계정과 서버의 분석 기록, 아직 보관 중인 업로드 사진이 삭제되며 복구할 수 없습니다.</p>

        {!confirmingDeletion ? (
          <button type="button" onClick={() => setConfirmingDeletion(true)}>회원탈퇴 진행</button>
        ) : (
          <div className="account-danger__confirm">
            <label>
              <input type="checkbox" checked={deletionConfirmed} onChange={(event) => setDeletionConfirmed(event.target.checked)} />
              <span>삭제되는 정보를 확인했으며 회원탈퇴에 동의합니다.</span>
            </label>
            <div>
              <button type="button" disabled={pending} onClick={() => { setConfirmingDeletion(false); setDeletionConfirmed(false); }}>취소</button>
              <button type="button" disabled={!deletionConfirmed || pending} onClick={() => void handleDeleteAccount()}>
                {pending ? "탈퇴 처리 중..." : "계정 영구 삭제"}
              </button>
            </div>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
