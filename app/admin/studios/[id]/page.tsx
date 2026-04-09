"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeftIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["draft", "pending_review", "active", "suspended", "inactive"];

export default function StudioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entity, setEntity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerRole, setOwnerRole] = useState<string>("owner");

  useEffect(() => {
    if (!id) return;
    // Use getEntities with search to find by ID (or we could add a getEntityById endpoint)
    adminApi
      .getEntities({ search: "", page: 1, limit: 1 })
      .then(() => {
        // For now fetch all and find — will be replaced with dedicated endpoint
        return fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/entities/${id}`
        ).then((r) => r.json());
      })
      .then((res) => setEntity(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    try {
      await adminApi.updateEntity(id, { status: newStatus });
      setEntity({ ...entity, status: newStatus });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignOwner = async () => {
    if (!ownerEmail) return;
    setSaving(true);
    try {
      // In a real implementation, we'd look up the user by email first
      await adminApi.assignOwner(id, ownerEmail, ownerRole);
      setOwnerEmail("");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!entity) {
    return <p className="text-muted-foreground">Entity not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-2xl font-bold">{entity.name}</h1>
        <Badge variant="outline">{entity.status}</Badge>
      </div>

      {/* Profile Info */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Entity Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">City</p>
            <p className="font-medium">{entity.city || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{entity.email || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="font-medium">{entity.phone || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Partnership</p>
            <p className="font-medium">
              {entity.is_partner ? entity.partnership_tier : "Not a partner"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Rating</p>
            <p className="font-medium">{entity.platform_rating ?? "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Reviews</p>
            <p className="font-medium">{entity.total_reviews}</p>
          </div>
        </div>
      </div>

      {/* Status Management */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Change Status</h2>
        <div className="flex gap-3 items-center">
          <Select value={entity.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && <span className="text-sm text-muted-foreground">Saving...</span>}
        </div>
      </div>

      {/* Assign Owner */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Assign Owner</h2>
        <p className="text-sm text-muted-foreground">
          Enter the user ID to assign as owner/manager/staff of this entity.
        </p>
        <div className="flex gap-3">
          <Input
            placeholder="User ID"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className="flex-1"
          />
          <Select value={ownerRole} onValueChange={setOwnerRole}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAssignOwner} disabled={saving || !ownerEmail}>
            Assign
          </Button>
        </div>
      </div>
    </div>
  );
}
