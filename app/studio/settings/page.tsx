"use client";

import { useEffect, useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react";

interface EntityProfile {
  id: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
}

export default function SettingsPage() {
  const { roles } = useAuth();
  const [entity, setEntity] = useState<EntityProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const entityId = roles?.ownedEntities?.[0]?.entityId;

  useEffect(() => {
    if (!entityId) return;
    // Fetch entity profile from the owned entities data
    const owned = roles?.ownedEntities?.[0];
    if (owned) {
      setEntity({
        id: owned.entityId,
        name: owned.entityName,
        city: "",
      });
    }
    setLoading(false);
  }, [entityId, roles]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  const fields = [
    { label: "Name", value: entity?.name },
    { label: "Description", value: entity?.description },
    { label: "Email", value: entity?.email },
    { label: "Phone", value: entity?.phone },
    { label: "City", value: entity?.city },
    { label: "Address", value: entity?.address },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary">
                <SettingsIcon className="size-5" />
              </div>
              <CardTitle>Studio Profile</CardTitle>
            </div>
            <Button variant="outline" disabled>
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div key={field.label}>
                <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
                <p className="mt-1 text-foreground">
                  {field.value || <span className="text-muted-foreground italic">Not set</span>}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
