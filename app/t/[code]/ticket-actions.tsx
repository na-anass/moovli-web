"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Labels {
  cancelAction: string;
  confirmQuestion: string;
  confirmYes: string;
  keep: string;
  cancelling: string;
  error: string;
}

export function TicketActions({
  code,
  apiBase,
  labels,
}: {
  code: string;
  apiBase: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/api/bookings/ticket/${encodeURIComponent(code)}/cancel`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(labels.error);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError(labels.error);
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded-lg border border-destructive/30 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/5"
      >
        {labels.cancelAction}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted-foreground">{labels.confirmQuestion}</p>
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="flex-1 rounded-lg border py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {labels.keep}
        </button>
        <button
          onClick={cancel}
          disabled={busy}
          className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? labels.cancelling : labels.confirmYes}
        </button>
      </div>
    </div>
  );
}
