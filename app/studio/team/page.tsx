"use client";

import { useCallback, useEffect, useState } from "react";
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

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "staff">("staff");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const entityId = activeEntity.entityId;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim());

  const resetInvite = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteRole("staff");
    setError(null);
  };

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

  const handleAdd = async () => {
    if (!entityId || !emailValid) return;
    const email = inviteEmail.trim().toLowerCase();
    setAdding(true);
    setError(null);
    try {
      const res = await studioApi.addTeamMember(entityId, {
        email,
        name: inviteName.trim() || undefined,
        role: inviteRole,
      });
      const { invited, alreadyMember } = res.data;
      setNotice(
        alreadyMember
          ? t("team.invite.noticeAlready", { email })
          : invited
            ? t("team.invite.noticeInvited", { email })
            : t("team.invite.noticeAdded", { email }),
      );
      setDialogOpen(false);
      resetInvite();
      await fetchTeam();
      window.setTimeout(() => setNotice(null), 6000);
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
        {notice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            {notice}
          </div>
        )}

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

        {/* Invite sheet — email-first: works whether or not the person is registered */}
        <FormSheet
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetInvite();
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
              <Button onClick={handleAdd} disabled={adding || !emailValid}>
                <UserPlusIcon className="size-4 mr-1.5" />
                {adding ? t("team.invite.inviting") : t("team.invite.sendInvite")}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("team.invite.emailLabel")}</label>
              <Input
                type="email"
                autoFocus
                placeholder={t("team.invite.emailPlaceholder")}
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setError(null); }}
                className="mt-1.5"
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t("team.invite.nameLabel")}</label>
              <Input
                placeholder={t("team.invite.namePlaceholder")}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <label className="text-sm font-medium">{t("team.invite.role")}</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "manager" | "staff")}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["manager", "staff"] as const).map((key) => {
                    const Icon = ROLE_CONFIG[key].icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5" />
                          {t(`team.roles.${key}.label`)}
                          <span className="text-muted-foreground text-xs">— {t(`team.roles.${key}.description`)}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">{t("team.invite.hint")}</p>

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
