"use client";

import { LoginLink } from "@/features/auth/components/login-link";
import Image from "next/image";
import { useState } from "react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, LogOut, UserRound } from "lucide-react";

function Account() {
  const { data: session, status } = useSession();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if (status === "loading") return null;
  if (!session?.user) return <LoginLink className="account-login">Masuk</LoginLink>;
  const name = session.user.name || session.user.email || "Akun Google";
  const avatar = session.user.image && failedImage !== session.user.image
    ? <Image src={session.user.image} alt="" width={40} height={40} unoptimized onError={() => setFailedImage(session.user?.image ?? null)} />
    : <UserRound size={19} />;
  return <Popover.Root>
    <Popover.Trigger className="account-trigger" aria-label="Buka menu akun">
      <span className="account-avatar" aria-hidden="true">{avatar}</span>
      <span className="account-trigger-name">{name}</span>
      <ChevronDown className="account-chevron" size={16} aria-hidden="true" />
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="bottom" align="end" sideOffset={8} className="account-positioner"><Popover.Popup className="account-menu">
      <div className="account-menu-identity">
        <span className="account-avatar account-avatar-large" aria-hidden="true">{avatar}</span>
        <div className="account-identity-copy">
          <span className="account-provider">Akun Google</span>
          <Popover.Title className="account-name">{name}</Popover.Title>
          {session.user.email && <p className="account-email">{session.user.email}</p>}
        </div>
      </div>
      <button type="button" className="account-logout" onClick={() => signOut({ redirectTo: "/login" })}><LogOut size={16} aria-hidden="true" /> Keluar akun</button>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}

export function AccountMenu() {
  return <SessionProvider refetchOnWindowFocus><Account /></SessionProvider>;
}
