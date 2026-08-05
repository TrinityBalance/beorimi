"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "홈", icon: "home", featured: false },
  { href: "/capture", label: "촬영", icon: "camera", featured: true },
  { href: "/history", label: "기록", icon: "history", featured: false },
  { href: "/help", label: "도움말", icon: "help", featured: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const hidden = pathname.startsWith("/analyze");

  if (hidden) return null;

  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {navigation.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href) ||
              (item.featured && pathname.startsWith("/result"));

        return (
          <Link
            className={`bottom-nav__item ${item.featured ? "is-featured" : ""} ${isActive ? "is-active" : ""}`}
            href={item.href}
            key={item.href}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={`nav-icon nav-icon--${item.icon}`} aria-hidden="true">
              {item.icon === "help" ? "?" : ""}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
