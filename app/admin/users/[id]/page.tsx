"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/datetime";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftIcon } from "lucide-react";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    adminApi
      .getUserById(id)
      .then((res) => setUser(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusToggle = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const newStatus = user.status === "active" ? "suspended" : "active";
      await adminApi.updateUserStatus(id, newStatus);
      setUser({ ...user, status: newStatus });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminToggle = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const newAdmin = !user.is_admin;
      await adminApi.setUserAdmin(id, newAdmin);
      setUser({ ...user, is_admin: newAdmin });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
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

  if (!user) {
    return <p className="text-muted-foreground">User not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <Badge
          variant="outline"
          className={
            user.status === "active"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }
        >
          {user.status}
        </Badge>
        {user.is_admin && (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            Admin
          </Badge>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="font-medium">{user.phone || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">City</p>
            <p className="font-medium">{user.city || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Joined</p>
            <p className="font-medium">
              {formatDate(user.created_at)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Credit Balance</p>
            <p className="font-medium text-lg">{user.credit_balance}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Purchased</p>
            <p className="font-medium">{user.total_credits_purchased}</p>
          </div>
        </div>
      </div>

      {user.entityRoles?.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-lg font-semibold">Entity Roles</h2>
          {user.entityRoles.map((er: any) => (
            <div key={er.entity_id} className="flex items-center justify-between text-sm">
              <span>{er.entities?.name || er.entity_id}</span>
              <Badge variant="outline">{er.role}</Badge>
            </div>
          ))}
        </div>
      )}

      {user.instructorProfiles?.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <h2 className="text-lg font-semibold">Instructor Profiles</h2>
          {user.instructorProfiles.map((ip: any) => (
            <div key={ip.id} className="text-sm">
              Provider ID: {ip.id} — Entity: {ip.primary_entity_id || "N/A"}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="flex gap-3">
          <Button
            variant={user.status === "active" ? "destructive" : "default"}
            onClick={handleStatusToggle}
            disabled={actionLoading}
          >
            {user.status === "active" ? "Suspend User" : "Activate User"}
          </Button>
          <Button
            variant="outline"
            onClick={handleAdminToggle}
            disabled={actionLoading}
          >
            {user.is_admin ? "Revoke Admin" : "Grant Admin"}
          </Button>
        </div>
      </div>
    </div>
  );
}
