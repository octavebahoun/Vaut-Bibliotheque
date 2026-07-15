"use client";

import { useCallback, useRef, useState } from "react";

export type ToastState = { msg: string; error: boolean; key: number } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, error = false) => {
    setToast({ msg, error, key: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  return { toast, show };
}

export default function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      className={`toast ${toast ? "show" : ""} ${toast?.error ? "error" : ""}`}
      key={toast?.key}
    >
      {toast?.msg ?? ""}
    </div>
  );
}
