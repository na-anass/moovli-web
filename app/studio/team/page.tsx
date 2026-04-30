"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trash2Icon,
  UserPlusIcon,
  SearchIcon,
  ShieldIcon,
  Users2Icon,
  UserIcon,
} from "lucide-react";

interface TeamMember {
  user_id: string;
  role: string;
  is_primary: boolean;
  created_at: string;
  user?: { name: string; email: string; avatar_url: string | null };
}

interface SearchUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  city: string | null;
}

const ROLE_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string; description: string }> = {
  owner: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: ShieldIcon, label: "Owner", description: "Full access — manage team, billing, delete studio" },
  manager: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Users2Icon, label: "Manager", description: "Manage sessions, pricing, instructors, insights" },
  staff: { color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: UserIcon, label: "Staff", description: "View dashboard, bookings, check in attendees" },
};

export default function TeamPage() {
  const { roles, user: currentUser } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [inviteRole, setInviteRole] = useState("staff");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedUser(null);
    setError(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 3) { setSearchResults([]); return; }

    searchTimeout.current = setTimeout(async () => {
      if (!entityId) return;
      setSearching(true);
      try {
        const res = await studioApi.searchUsers(entityId, value);
        const existingIds = new Set(members.map((m) => m.user_id));
        setSearchResults(res.data.filter((u) => !existingIds.has(u.id)));
      } catch (e) { console.error(e); }
      finally { setSearching(false); }
    }, 300);
  };

  const handleAdd = async () => {
    if (!entityId || !selectedUser) return;
    setAdding(true);
    setError(null);
    try {
      await studioApi.addTeamMember(entityId, selectedUser.id, inviteRole);
      setDialogOpen(false);
      setSearchQuery(""); setSearchResults([]); setSelectedUser(null); setInviteRole("staff");
      await fetchTeam();
    } catch (e: any) {
      setError(e.message || "Failed to add team member");
    } finally { setAdding(false); }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    if (!entityId) return;
    try { await studioApi.updateTeamMemberRole(entityId, userId, role); await fetchTeam(); }
    catch (e) { console.error(e); }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!entityId || !confirm(`Remove ${name} from the team?`)) return;
    try { await studioApi.removeTeamMember(entityId, userId); await fetchTeam(); }
    catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold">Team</h1>
        <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team</h1>
            <p className="text-sm text-muted-foreground mt-1">{members.length} member{members.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlusIcon className="size-4 mr-2" />
            Invite Member
          </Button>
        </div>

        {/* Team table */}
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No team members yet. Invite someone to get started.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => {
                  const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.staff;
                  const isCurrentUser = member.user_id === currentUser?.id;
                  return (
                    <TableRow key={member.user_id}>
                      {/* Member info */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {member.user?.avatar_url ? (
                            <img src={member.user.avatar_url} alt="" className="size-8 rounded-full object-cover" />
                          ) : (
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                              {(member.user?.name || "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {member.user?.name || "Unknown"}
                              {isCurrentUser && <span className="text-muted-foreground font-normal ml-1">(you)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.user?.email || member.user_id}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Role */}
                      <TableCell>
                        {isCurrentUser ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className={`${roleConfig.color} cursor-help`}>
                                {roleConfig.label}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs max-w-48">{roleConfig.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Select
                                  value={member.role}
                                  onValueChange={(v) => handleRoleChange(member.user_id, v)}
                                >
                                  <SelectTrigger className="w-28 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                                      <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-1.5">
                                          <cfg.icon className="size-3" />
                                          {cfg.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs max-w-48">{roleConfig.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>

                      {/* Joined */}
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>

                      {/* Remove */}
                      <TableCell>
                        {!isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(member.user_id, member.user?.name || "this member")}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Invite Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) { setSearchQuery(""); setSearchResults([]); setSelectedUser(null); setError(null); }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Search by email to add an existing Moovli user to your team.
              </p>

              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>

              {searching && <p className="text-sm text-muted-foreground text-center py-2">Searching...</p>}

              {!searching && searchQuery.length >= 3 && searchResults.length === 0 && !selectedUser && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">No users found for &quot;{searchQuery}&quot;</p>
                  <p className="text-xs text-muted-foreground mt-1">They need a Moovli account first.</p>
                </div>
              )}

              {searchResults.length > 0 && !selectedUser && (
                <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-y-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left transition-colors"
                      onClick={() => { setSelectedUser(u); setSearchResults([]); }}
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="size-8 rounded-full object-cover" />
                      ) : (
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedUser && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-3">
                    {selectedUser.avatar_url ? (
                      <img src={selectedUser.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{selectedUser.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs"
                      onClick={() => { setSelectedUser(null); setSearchQuery(""); }}>
                      Change
                    </Button>
                  </div>
                </div>
              )}

              {selectedUser && (
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <cfg.icon className="size-3.5" />
                            {cfg.label}
                            <span className="text-muted-foreground text-xs">— {cfg.description}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} disabled={adding || !selectedUser}>
                  <UserPlusIcon className="size-4 mr-1.5" />
                  {adding ? "Inviting..." : "Add to Team"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
