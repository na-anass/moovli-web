"use client";

import { useCallback, useEffect, useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrashIcon } from "lucide-react";

interface TeamMember {
  user_id: string;
  role: string;
  created_at: string;
  users?: { name: string; email: string };
}

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  staff: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export default function TeamPage() {
  const { roles } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("staff");
  const [adding, setAdding] = useState(false);

  const entityId = roles?.ownedEntities?.[0]?.entityId;

  const fetchTeam = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await studioApi.getTeam(entityId);
      setMembers(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleAdd = async () => {
    if (!entityId || !newUserId.trim()) return;
    setAdding(true);
    try {
      await studioApi.addTeamMember(entityId, newUserId.trim(), newRole);
      setNewUserId("");
      setNewRole("staff");
      await fetchTeam();
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    if (!entityId) return;
    try {
      await studioApi.updateTeamMemberRole(entityId, userId, role);
      await fetchTeam();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!entityId) return;
    try {
      await studioApi.removeTeamMember(entityId, userId);
      await fetchTeam();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Team</h1>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Team</h1>

      {/* Add member form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Add Team Member</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium text-foreground mb-1 block">User ID</label>
            <Input
              placeholder="Enter user ID"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
            />
          </div>
          <div className="w-40">
            <label className="text-sm font-medium text-foreground mb-1 block">Role</label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={adding || !newUserId.trim()}>
            {adding ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>

      {/* Team members list */}
      <div className="rounded-xl border border-border bg-card">
        {members.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No team members found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {member.users?.name || "Unknown"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.users?.email || member.user_id}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Joined {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={roleColors[member.role] || ""}>
                    {member.role}
                  </Badge>
                  <Select
                    value={member.role}
                    onValueChange={(value) => handleRoleChange(member.user_id, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(member.user_id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
