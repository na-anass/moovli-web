"use client";

import { useAuth } from "@/lib/auth/provider";
import { Button } from "@/components/ui/button";
import { ShieldOffIcon, LogOutIcon } from "lucide-react";

export default function NoAccessPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md px-4">
        <div className="flex justify-center">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <ShieldOffIcon className="size-8 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">No Dashboard Access</h1>
          <p className="text-muted-foreground">
            The account <span className="font-medium text-foreground">{user?.email}</span> does
            not have access to any Moovli dashboard. You need to be assigned as a
            studio owner, manager, staff member, or instructor.
          </p>
          <p className="text-sm text-muted-foreground">
            Contact your studio owner or the Moovli support team to get access.
          </p>
        </div>
        <Button onClick={() => signOut()} variant="outline">
          <LogOutIcon className="size-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
