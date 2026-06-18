"use client";

import { AccountPage } from "@/components/shared/account-page";

// Instructor settings reuse the shared personal-account page (profile details,
// notification preferences, account/security) — the same template used across
// the other portals.
export default function InstructorSettingsPage() {
  return <AccountPage />;
}
