"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
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
  const t = useTranslations("admin");
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
    return <p className="text-muted-foreground">{t("studioDetail.notFound")}</p>;
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
        <h2 className="text-lg font-semibold">{t("studioDetail.entityDetails")}</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t("studioDetail.city")}</p>
            <p className="font-medium">{entity.city || t("studioDetail.na")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("studioDetail.email")}</p>
            <p className="font-medium">{entity.email || t("studioDetail.na")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("studioDetail.phone")}</p>
            <p className="font-medium">{entity.phone || t("studioDetail.na")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("studioDetail.partnership")}</p>
            <p className="font-medium">
              {entity.is_partner ? entity.partnership_tier : t("studioDetail.notPartner")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("studioDetail.rating")}</p>
            <p className="font-medium">{entity.platform_rating ?? t("studioDetail.na")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("studioDetail.reviews")}</p>
            <p className="font-medium">{entity.total_reviews}</p>
          </div>
        </div>
      </div>

      {/* Status Management */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t("studioDetail.changeStatus")}</h2>
        <div className="flex gap-3 items-center">
          <Select value={entity.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`studioDetail.statuses.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && <span className="text-sm text-muted-foreground">{t("studioDetail.saving")}</span>}
        </div>
      </div>

      {/* Assign Owner */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold">{t("studioDetail.assignOwner")}</h2>
          <InfoTip term="team" />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("studioDetail.assignOwnerHint")}
        </p>
        <div className="flex gap-3">
          <Input
            placeholder={t("studioDetail.userIdPlaceholder")}
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className="flex-1"
          />
          <Select value={ownerRole} onValueChange={setOwnerRole}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">{t("studioDetail.roleOwner")}</SelectItem>
              <SelectItem value="manager">{t("studioDetail.roleManager")}</SelectItem>
              <SelectItem value="staff">{t("studioDetail.roleStaff")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAssignOwner} disabled={saving || !ownerEmail}>
            {t("studioDetail.assign")}
          </Button>
        </div>
      </div>
    </div>
  );
}
