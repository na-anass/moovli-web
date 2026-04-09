"use client";

import { useEffect, useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusIcon, StarIcon, MailIcon, PhoneIcon } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  bio?: string;
  title?: string;
  tier?: string;
  rating?: number;
  total_reviews?: number;
  total_sessions?: number;
  avatar_url?: string;
  specializations?: string[];
  is_active: boolean;
}

const tierColors: Record<string, string> = {
  standard: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  premium: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  elite: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function InstructorsPage() {
  const { roles } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", bio: "" });

  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const currentRole = roles?.ownedEntities?.[0]?.role;
  const canManage = currentRole === "manager" || currentRole === "owner" || roles?.isAdmin;

  const fetchProviders = () => {
    if (!entityId) return;
    studioApi.getProviders(entityId)
      .then((res) => setProviders(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProviders(); }, [entityId]);

  const handleAdd = async () => {
    if (!entityId || !form.name.trim()) return;
    setSaving(true);
    try {
      await studioApi.inviteProvider(entityId, {
        name: form.name,
        email: form.email || undefined,
      });
      setForm({ name: "", email: "", phone: "", bio: "" });
      setDialogOpen(false);
      fetchProviders();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Instructors</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Instructors</h1>
          <p className="text-sm text-muted-foreground mt-1">{providers.length} instructor{providers.length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="size-4 mr-2" />
                Add Instructor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Instructor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    className="mt-1.5"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Instructor name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    className="mt-1.5"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    className="mt-1.5"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+212..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Bio</label>
                  <textarea
                    className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="Short bio..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAdd} disabled={saving || !form.name.trim()}>
                    {saving ? "Adding..." : "Add Instructor"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {providers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <PlusIcon className="size-6 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">No instructors yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Add your first instructor to assign them to sessions and let them manage their schedule.
          </p>
          {canManage && (
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <PlusIcon className="size-4 mr-2" />
              Add Instructor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {providers.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-4">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.name} className="size-14 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="flex items-center justify-center size-14 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                    {getInitials(p.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{p.name}</h3>
                    {!p.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                  </div>
                  {p.title && <p className="text-sm text-muted-foreground">{p.title}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className={tierColors[p.tier || "standard"]}>
                      {p.tier || "standard"}
                    </Badge>
                    {p.rating != null && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                        {Number(p.rating).toFixed(1)}
                        {p.total_reviews ? ` (${p.total_reviews})` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(p.email || p.phone || p.specializations?.length) && (
                <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                  {p.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MailIcon className="size-3" /> {p.email}
                    </p>
                  )}
                  {p.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <PhoneIcon className="size-3" /> {p.phone}
                    </p>
                  )}
                  {p.specializations && p.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.specializations.map((s) => (
                        <span key={s} className="text-xs bg-muted px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
