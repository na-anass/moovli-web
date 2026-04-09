"use client";

import { useEffect, useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";

interface Provider {
  id: string;
  name: string;
  title?: string;
  tier?: string;
  rating?: number;
  avatar_url?: string;
}

const tierColors: Record<string, string> = {
  senior: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  junior: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  lead: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function InstructorsPage() {
  const { roles } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const entityId = roles?.ownedEntities?.[0]?.entityId;

  useEffect(() => {
    if (!entityId) return;
    studioApi
      .getProviders(entityId)
      .then((res) => setProviders(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Instructors</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Instructors</h1>
        <p className="text-sm text-muted-foreground">{providers.length} instructors</p>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No instructors found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="rounded-xl border border-border bg-card p-6 flex items-start gap-4"
            >
              {provider.avatar_url ? (
                <img
                  src={provider.avatar_url}
                  alt={provider.name}
                  className="size-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {getInitials(provider.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{provider.name}</p>
                {provider.title && (
                  <p className="text-sm text-muted-foreground truncate">{provider.title}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {provider.tier && (
                    <Badge variant="outline" className={tierColors[provider.tier] || ""}>
                      {provider.tier}
                    </Badge>
                  )}
                  {provider.rating != null && (
                    <span className="text-sm text-muted-foreground">
                      {provider.rating.toFixed(1)} / 5
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
