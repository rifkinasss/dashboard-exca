"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return <Button type="button" variant="outline" onClick={() => signOut({ redirectTo: "/login" })}><LogOut size={16} aria-hidden="true" /> Keluar akun</Button>;
}
