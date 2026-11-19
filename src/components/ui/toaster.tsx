"use client";

import { Toast } from "@base-ui/react/toast";
import { CheckCircle2, AlertCircle, LoaderCircle, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ToastProvider({ children }: { children: ReactNode }) {
  return <Toast.Provider>{children}<ToastList /></Toast.Provider>;
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => setContainer(document.querySelector<HTMLDialogElement>("dialog[open]") ?? document.body);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);
  if (!container) return null;
  return createPortal(<Toast.Viewport className="app-toast-viewport">{toasts.map((toast) => <Toast.Root key={toast.id} toast={toast} className="app-toast" data-kind={toast.type}>
    {toast.type === "loading" ? <LoaderCircle className="app-toast-spinner" aria-hidden="true" /> : toast.type === "success" ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
    <Toast.Content className="app-toast-content"><Toast.Title className="app-toast-title" /><Toast.Description className="app-toast-description" /></Toast.Content>
    {toast.type !== "loading" && <Toast.Close className="app-toast-close" aria-label="Tutup notifikasi"><X size={16} /></Toast.Close>}
  </Toast.Root>)}</Toast.Viewport>, container);
}
