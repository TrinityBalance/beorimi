import type { PendingPhoto, SelectionRegion } from "@/types/analysis";

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

export async function preparePhoto(file: File): Promise<PendingPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 선택할 수 있어요.");
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error("15MB보다 작은 사진을 선택해주세요.");
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("사진을 처리할 수 없어요. 다시 시도해주세요.");
    }

    context.drawImage(image, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      name: toJpegFilename(file.name),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, encoded] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

export async function cropPhoto(
  photo: PendingPhoto,
  region: SelectionRegion,
): Promise<PendingPhoto> {
  const image = await loadImage(photo.dataUrl);
  const sourceX = Math.round((region.x / 100) * image.width);
  const sourceY = Math.round((region.y / 100) * image.height);
  const sourceWidth = Math.max(1, Math.round((region.width / 100) * image.width));
  const sourceHeight = Math.max(1, Math.round((region.height / 100) * image.height));
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("선택한 영역을 처리할 수 없어요. 다시 시도해주세요.");
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  return {
    dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    name: toJpegFilename(photo.name),
    width: sourceWidth,
    height: sourceHeight,
  };
}

function toJpegFilename(filename: string): string {
  const baseName = filename.trim().replace(/\.[^.]+$/, "") || `camera-${Date.now()}`;
  return `${baseName}.jpg`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("사진을 불러오지 못했어요."));
    image.src = url;
  });
}
