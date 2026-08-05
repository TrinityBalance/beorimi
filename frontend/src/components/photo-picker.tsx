"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { preparePhoto } from "@/lib/image";
import { savePendingPhoto } from "@/lib/analysis-store";

type PhotoPickerProps = {
  mode: "camera" | "album";
  variant?: "hero" | "secondary" | "inline";
  label?: string;
};

export function PhotoPicker({
  mode,
  variant = "inline",
  label,
}: PhotoPickerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState("");

  const visibleLabel =
    label ?? (mode === "camera" ? "사진 찍기" : "앨범에서 선택");

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setError("");
    setIsPreparing(true);

    try {
      const photo = await preparePhoto(file);
      savePendingPhoto(photo);
      router.push("/capture");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "사진을 준비하지 못했어요.");
      setIsPreparing(false);
    }
  }

  return (
    <>
      <button
        className={`photo-picker photo-picker--${variant}`}
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isPreparing}
      >
        <span className="photo-picker__icon" aria-hidden="true">
          {mode === "camera" ? <span className="camera-glyph" /> : <span className="album-glyph" />}
        </span>
        <span className="photo-picker__copy">
          <strong>{isPreparing ? "사진 준비 중…" : visibleLabel}</strong>
          {variant === "secondary" && <small>휴대폰에 저장된 사진을 불러와요</small>}
        </span>
        {variant === "secondary" && <span className="chevron" aria-hidden="true">›</span>}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        capture={mode === "camera" ? "environment" : undefined}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
