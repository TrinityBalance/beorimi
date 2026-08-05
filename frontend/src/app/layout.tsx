import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BottomNav } from "@/components/bottom-nav";
import { ConfigureAmplify } from "@/components/configure-amplify";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const siteUrl = new URL(`${protocol}://${host}`);
  const title = "버리미 | 사진으로 확인하는 강남구 대형폐기물";
  const description = "대형폐기물 사진을 찍으면 강남구 품목, 예상 수수료, 배출 방법을 안내해드려요.";

  return {
    metadataBase: siteUrl,
    title: {
      default: title,
      template: "%s | 버리미",
    },
    description,
    applicationName: "버리미",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "버리미",
    },
    formatDetection: {
      telephone: false,
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "버리미",
      locale: "ko_KR",
      url: siteUrl,
      images: [{ url: new URL("/og.png", siteUrl), width: 1536, height: 1024, alt: "버리미 서비스 미리보기" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [new URL("/og.png", siteUrl)],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#dfff3f",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <div className="app-frame">
          <ConfigureAmplify />
          {children}
          <BottomNav />
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
