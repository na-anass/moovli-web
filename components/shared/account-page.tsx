"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/datetime";
import { useAuth } from "@/lib/auth/provider";
import { apiClient } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import { BaseLayout } from "@/components/layout/base-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FormSection,
  FormField,
  useEditModeSync,
} from "@/components/shared/form-layout";
import {
  AlertCircleIcon,
  CameraIcon,
  CheckIcon,
  GlobeIcon,
  KeyIcon,
  Loader2Icon,
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
  // Surfaced page-level error for save / avatar / password failures (previously
  // these were only console.error'd, so a failure looked like "nothing happened").
  const [error, setError] = useState<string | null>(null);

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

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password change (independent of the profile Edit/Save flow)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

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
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const res = await apiClient<{ success: boolean; data: UserProfile }>("/api/users/me", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setProfile({ ...profile!, ...res.data });
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError((e as Error).message || "Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) syncForm(profile);
    setEditing(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const res = await apiClient<{ success: boolean; data: { path: string; url: string } }>(
        "/api/users/me/avatar",
        { method: "POST", body: file, headers: { "Content-Type": file.type } },
      );
      setProfile((p) => (p ? { ...p, avatar_url: res.data.url } : p));
    } catch (err) {
      setError((err as Error).message || "Couldn't upload your photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    setError(null);
    setPwSuccess(false);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setPwSaving(true);
    try {
      const supabase = createClient();
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) throw new Error(pwError.message);
      setNewPassword("");
      setConfirmPassword("");
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message || "Couldn't update your password. Please try again.");
    } finally {
      setPwSaving(false);
    }
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
          {/* Page-level error banner (save / avatar / password failures) */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="flex-1 text-sm text-destructive">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-destructive/80 hover:text-destructive"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Profile header */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                {profile.avatar_url ? (
                  <Image src={profile.avatar_url} alt={profile.name} width={72} height={72}
                    className="rounded-full object-cover size-[72px]" />
                ) : (
                  <div className="size-[72px] rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Change photo"
                  className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border border-border bg-background hover:bg-muted disabled:opacity-60"
                >
                  {uploadingAvatar ? (
                    <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <CameraIcon className="size-3.5 text-muted-foreground" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
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
              <FormField label="Bio" span={2} multiline
                placeholder="Tell us a little about yourself"
                editing={editing} value={profile.bio} formValue={form.bio}
                onChange={(v) => setForm({ ...form, bio: v })} />
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

          {/* Security — password change (independent of the profile Edit/Save flow) */}
          <FormSection title="Security" icon={<ShieldIcon className="size-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <KeyIcon className="size-3.5" /> New password
                </label>
                <Input type="password" className="mt-1.5" value={newPassword}
                  autoComplete="new-password" placeholder="At least 8 characters"
                  onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Confirm password</label>
                <Input type="password" className="mt-1.5" value={confirmPassword}
                  autoComplete="new-password" placeholder="Re-enter new password"
                  onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleChangePassword} disabled={pwSaving || !newPassword || !confirmPassword}>
                {pwSaving ? "Updating…" : "Update password"}
              </Button>
              {pwSuccess && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 gap-1">
                  <CheckIcon className="size-3" /> Password updated
                </Badge>
              )}
            </div>
          </FormSection>
        </div>
    </BaseLayout>
  );
}
