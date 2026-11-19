"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function LoginLink({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  return <Link href="/login" className={className} onClick={(event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    router.push(`/login?callbackUrl=${encodeURIComponent(current)}`);
  }}>{children}</Link>;
}
