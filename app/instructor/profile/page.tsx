"use client";

import { useEffect, useState } from "react";
import { instructorApi } from "@/lib/api/instructor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function InstructorProfilePage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState("");
  const [specializations, setSpecializations] = useState("");

  useEffect(() => {
    instructorApi
      .getMyProfile()
      .then((res) => {
        setProfiles(res.data);
        if (res.data.length > 0) {
          setBio(res.data[0].bio || "");
          setSpecializations(
            (res.data[0].specializations || []).join(", ")
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await instructorApi.updateProfile({
        bio,
        specializations: specializations
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const profile = profiles[0];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {profile && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
              {profile.name?.charAt(0) || "?"}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{profile.name}</h2>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">{profile.tier || "standard"}</Badge>
                {profile.rating && (
                  <Badge variant="outline">
                    {profile.rating} rating
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{profile.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Studio</p>
              <p className="font-medium">{profile.entity?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Sessions</p>
              <p className="font-medium">{profile.total_sessions || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Reviews</p>
              <p className="font-medium">{profile.total_reviews || 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Edit Profile</h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Bio</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell students about yourself..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Specializations (comma-separated)
            </label>
            <Input
              className="mt-1"
              value={specializations}
              onChange={(e) => setSpecializations(e.target.value)}
              placeholder="Yoga, Pilates, HIIT"
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
