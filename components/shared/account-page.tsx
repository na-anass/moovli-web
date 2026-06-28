"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/datetime";
import { useAuth } from "@/lib/auth/provider";
import { apiClient } from "@/lib/api/client";
import { BaseLayout } from "@/components/layout/base-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  FormSection,
  FormField,
  useEditModeSync,
} from "@/components/shared/form-layout";
import {
  BellIcon,
  CheckIcon,
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  preferred_language: string | null;
  notification_preferences: Record<string, boolean>;
  credit_balance: number;
  total_credits_purchased: number;
  total_credits_spent: number;
  is_admin: boolean;
  status: string;
  created_at: string;
}

export function AccountPage() {
  const { roles } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    bio: "",
    date_of_birth: "",
    gender: "",
    city: "",
    region: "",
    country: "",
    preferred_language: "",
  });

  const [notifications, setNotifications] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiClient<{ success: boolean; data: UserProfile }>("/api/users/me")
      .then((res) => {
        setProfile(res.data);
        syncForm(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const syncForm = (p: UserProfile) => {
    setForm({
      name: p.name || "",
      phone: p.phone || "",
      bio: p.bio || "",
      date_of_birth: p.date_of_birth ? p.date_of_birth.split("T")[0] : "",
      gender: p.gender || "",
      city: p.city || "",
      region: p.region || "",
      country: p.country || "MA",
      preferred_language: p.preferred_language || "en",
    });
    setNotifications(p.notification_preferences || {});
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const res = await apiClient<{ success: boolean; data: UserProfile }>("/api/users/me", {
        method: "PUT",
        body: JSON.stringify({ ...form, notification_preferences: notifications }),
      });
      setProfile({ ...profile!, ...res.data });
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) syncForm(profile);
    setEditing(false);
  };

  // Sync edit state to top bar (must run on every render path, before any early return).
  useEditModeSync({
    editing,
    saving,
    title: "My Account",
    onSave: handleSave,
    onCancel: handleCancel,
  });

  if (loading) {
    return (
      <BaseLayout maxWidth="md" title="My Account">
        <div className="h-32 rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
      </BaseLayout>
    );
  }

  if (!profile) return <p className="text-muted-foreground">Failed to load profile.</p>;

  const notifLabels: Record<string, string> = {
    push: "Push notifications",
    bookingUpdates: "Booking updates",
    checkInReminders: "Check-in reminders",
    paymentConfirmations: "Payment confirmations",
    reviewRequests: "Review requests",
    specialOffers: "Special offers",
    marketingEmails: "Marketing emails",
  };

  return (
    <BaseLayout
      maxWidth="md"
      title="My Account"
      action={
        <>
          {success && (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 gap-1">
              <CheckIcon className="size-3" /> Saved
            </Badge>
          )}
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
          )}
        </>
      }
    >
        <div className="space-y-6">
          {/* Profile header */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-5">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.name} width={72} height={72}
                  className="rounded-full object-cover size-[72px]" />
              ) : (
                <div className="size-[72px] rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-xl font-bold">{editing ? form.name : profile.name}</h2>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline">{profile.status}</Badge>
                  {profile.is_admin && (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      <ShieldIcon className="size-3 mr-1" />Admin
                    </Badge>
                  )}
                  {(roles?.ownedEntities?.length ?? 0) > 0 && (
                    <Badge variant="outline">Studio {roles!.ownedEntities[0].role}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Joined {formatDate(profile.created_at)}
                  </span>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-2xl font-bold text-primary">{profile.credit_balance}</p>
                <p className="text-xs text-muted-foreground">credits</p>
              </div>
            </div>
          </div>

          {/* Personal info */}
          <FormSection title="Personal Information" icon={<UserIcon className="size-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Full Name" icon={<UserIcon className="size-3.5" />} span={2}
                editing={editing} value={profile.name} formValue={form.name}
                onChange={(v) => setForm({ ...form, name: v })} />
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <MailIcon className="size-3.5" /> Email
                </label>
                <p className="mt-1.5 text-foreground text-sm">{profile.email}</p>
                {editing && <p className="text-[10px] text-muted-foreground mt-0.5">Email cannot be changed here</p>}
              </div>
              <FormField label="Phone" icon={<PhoneIcon className="size-3.5" />}
                editing={editing} value={profile.phone} formValue={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })} />
              {editing ? (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <Input type="date" className="mt-1.5" value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                </div>
              ) : (
                <FormField label="Date of Birth" editing={false}
                  value={profile.date_of_birth ? formatDate(profile.date_of_birth) : null}
                  formValue="" onChange={() => {}} />
              )}
              {editing ? (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Gender</label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="unspecified">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <FormField label="Gender" editing={false}
                  value={profile.gender === "unspecified" ? "Prefer not to say" : profile.gender}
                  formValue="" onChange={() => {}} />
              )}
            </div>
          </FormSection>

          {/* Location */}
          <FormSection title="Location" icon={<MapPinIcon className="size-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="City" editing={editing} value={profile.city} formValue={form.city}
                onChange={(v) => setForm({ ...form, city: v })} />
              <FormField label="Region" editing={editing} value={profile.region} formValue={form.region}
                onChange={(v) => setForm({ ...form, region: v })} />
              {editing ? (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Country</label>
                  <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MA">Morocco</SelectItem>
                      <SelectItem value="FR">France</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <FormField label="Country" editing={false} value={profile.country} formValue="" onChange={() => {}} />
              )}
              {editing ? (
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <GlobeIcon className="size-3.5" /> Language
                  </label>
                  <Select value={form.preferred_language} onValueChange={(v) => setForm({ ...form, preferred_language: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <FormField label="Language" icon={<GlobeIcon className="size-3.5" />} editing={false}
                  value={profile.preferred_language === "fr" ? "Français" : profile.preferred_language === "ar" ? "العربية" : "English"}
                  formValue="" onChange={() => {}} />
              )}
            </div>
          </FormSection>

          {/* Notifications */}
          <FormSection title="Notifications" icon={<BellIcon className="size-5" />}>
            <div className="space-y-3">
              {Object.entries(notifLabels).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-sm">{label}</span>
                  {editing ? (
                    <Switch checked={notifications[key] ?? false}
                      onCheckedChange={(v) => setNotifications({ ...notifications, [key]: v })} />
                  ) : (
                    <span className={`text-xs ${notifications[key] ? "text-green-600" : "text-muted-foreground"}`}>
                      {notifications[key] ? "On" : "Off"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </FormSection>

          {/* Credits */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Credits</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{profile.credit_balance}</p>
                <p className="text-xs text-muted-foreground">Balance</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{profile.total_credits_purchased}</p>
                <p className="text-xs text-muted-foreground">Purchased</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{profile.total_credits_spent}</p>
                <p className="text-xs text-muted-foreground">Spent</p>
              </div>
            </div>
          </div>
        </div>
    </BaseLayout>
  );
}
