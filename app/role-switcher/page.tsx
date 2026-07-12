"use client";

import { useAuth } from "@/lib/auth/provider";
import { useRouter } from "next/navigation";
import {
  ShieldIcon,
  BuildingIcon,
  GraduationCapIcon,
  LogOutIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface RoleCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

export default function RoleSwitcherPage() {
  const { roles, user, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const cards: RoleCard[] = [];

  if (roles?.isAdmin) {
    cards.push({
      title: "Admin Panel",
      description: "Manage users, studios, bookings, and platform analytics",
      icon: <ShieldIcon className="size-8" />,
      href: "/admin/dashboard",
      color: "from-purple-500 to-indigo-600",
    });
  }

  if (roles && roles.ownedEntities.length > 0) {
    cards.push({
      title: "Studio Dashboard",
      description: `Manage ${roles.ownedEntities.length} studio${roles.ownedEntities.length > 1 ? "s" : ""} — sessions, bookings, team`,
      icon: <BuildingIcon className="size-8" />,
      href: "/studio/dashboard",
      color: "from-orange-500 to-red-500",
    });
  }

  if (roles && roles.instructorEntities.length > 0) {
    cards.push({
      title: "Instructor Portal",
      description: `View your schedule, manage attendees, check in students`,
      icon: <GraduationCapIcon className="size-8" />,
      href: "/instructor/dashboard",
      color: "from-emerald-500 to-teal-600",
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex flex-col items-center space-y-3">
          <Image src="/img/moovli-icon.png" alt="Moovli" width={56} height={56} className="rounded-xl" />
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              {user?.email} — choose a dashboard
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {cards.map((card) => (
            <button
              key={card.href}
              onClick={() => router.push(card.href)}
              className="group flex items-center gap-6 rounded-2xl border border-border bg-card p-6 text-left transition-all hover:border-primary/30 hover:scale-[1.01]"
            >
              <div
                className={`flex size-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.color} text-white`}
              >
                {card.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {card.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {card.description}
                </p>
              </div>
              <svg
                className="size-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          ))}
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={() => signOut()} className="text-muted-foreground">
            <LogOutIcon className="size-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
