"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

export interface FaqItem {
  question: string;
  answer: string;
}

function FaqCard({ item, defaultOpen }: { item: FaqItem; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "rounded-xl border bg-card px-4 py-3.5 transition-colors",
          open && "border-primary/40",
        )}
      >
        <CollapsibleTrigger className="flex w-full items-start justify-between gap-3 text-left">
          <span className="text-sm font-semibold leading-snug">{item.question}</span>
          <span
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
              "bg-emerald-50 text-emerald-600",
            )}
            aria-hidden
          >
            {open ? <XIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="mt-2 pr-9 text-xs leading-relaxed text-muted-foreground">{item.answer}</p>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function MarketplaceFaq({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <FaqCard key={item.question} item={item} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
