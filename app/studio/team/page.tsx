"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/datetime";
import { BaseLayout } from "@/components/layout/base-layout";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { useActiveEntity } from "@/lib/studio/active-entity";
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
import { FormSheet } from "@/components/shared/form-sheet";
import { DataTable, type Column } from "@/components/shared/data-table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const ROLE_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  owner: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: ShieldIcon },
  manager: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Users2Icon },
  staff: { color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: UserIcon },
};

export default function TeamPage() {
  const t = useTranslations("studioMain");
  const { user: currentUser } = useAuth();
  const activeEntity = useActiveEntity();
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

  const entityId = activeEntity.entityId;

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
      setError(e.message || t("team.errors.addFailed"));
    } finally { setAdding(false); }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    if (!entityId) return;
    try { await studioApi.updateTeamMemberRole(entityId, userId, role); await fetchTeam(); }
    catch (e) { console.error(e); }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!entityId || !confirm(t("team.removeConfirm", { name }))) return;
    try { await studioApi.removeTeamMember(entityId, userId); await fetchTeam(); }
    catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <BaseLayout maxWidth="lg" title={t("team.title")}>
        <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
      </BaseLayout>
    );
  }

  const roleKey = (role: string) => (ROLE_CONFIG[role] ? role : "staff");

  const memberColumns: Column<TeamMember>[] = [
    {
      header: t("team.columns.member"),
      cell: (member) => {
        const isCurrentUser = member.user_id === currentUser?.id;
        return (
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
                {member.user?.name || t("team.unknown")}
                {isCurrentUser && <span className="text-muted-foreground font-normal ml-1">{t("team.you")}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{member.user?.email || member.user_id}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: t("team.columns.role"),
      cell: (member) => {
        const rk = roleKey(member.role);
        const roleConfig = ROLE_CONFIG[rk];
        const isCurrentUser = member.user_id === currentUser?.id;
        return isCurrentUser ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`${roleConfig.color} cursor-help`}>
                {t(`team.roles.${rk}.label`)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs max-w-48">{t(`team.roles.${rk}.description`)}</p>
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
                          {t(`team.roles.${key}.label`)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs max-w-48">{t(`team.roles.${rk}.description`)}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      header: t("team.columns.joined"),
      cell: (member) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(member.created_at)}
        </span>
      ),
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <BaseLayout
        maxWidth="lg"
        title={t("team.title")}
        subtitle={t("team.memberCount", { count: members.length })}
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlusIcon className="size-4 mr-2" />
            {t("team.inviteMember")}
          </Button>
        }
      >
        {/* Team table */}
        <DataTable
          columns={memberColumns}
          data={members}
          rowActions={(member) =>
            member.user_id === currentUser?.id
              ? []
              : [
                  {
                    label: t("team.removeFromTeam"),
                    icon: Trash2Icon,
                    variant: "destructive",
                    onClick: () =>
                      handleRemove(member.user_id, member.user?.name || t("team.thisMember")),
                  },
                ]
          }
        />

        {/* Invite sheet */}
        <FormSheet
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSearchQuery("");
              setSearchResults([]);
              setSelectedUser(null);
              setError(null);
            }
          }}
          title={t("team.invite.title")}
          subtitle={t("team.invite.subtitle")}
          icon={UserPlusIcon}
          iconAccent="primary"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                {t("team.invite.cancel")}
              </Button>
              <Button onClick={handleAdd} disabled={adding || !selectedUser}>
                <UserPlusIcon className="size-4 mr-1.5" />
                {adding ? t("team.invite.inviting") : t("team.invite.addToTeam")}
              </Button>
            </>
          }
        >
          <div className="space-y-4">

              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={t("team.invite.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>

              {searching && <p className="text-sm text-muted-foreground text-center py-2">{t("team.invite.searching")}</p>}

              {!searching && searchQuery.length >= 3 && searchResults.length === 0 && !selectedUser && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">{t("team.invite.noUsers", { query: searchQuery })}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("team.invite.needAccount")}</p>
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
                      {t("team.invite.change")}
                    </Button>
                  </div>
                </div>
              )}

              {selectedUser && (
                <div>
                  <label className="text-sm font-medium">{t("team.invite.role")}</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <cfg.icon className="size-3.5" />
                            {t(`team.roles.${key}.label`)}
                            <span className="text-muted-foreground text-xs">— {t(`team.roles.${key}.description`)}</span>
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
            </div>
        </FormSheet>
      </BaseLayout>
    </TooltipProvider>
  );
}
