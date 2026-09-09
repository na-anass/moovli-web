import { redirect } from "next/navigation";

// /admin has no page of its own — send it to the dashboard.
export default function AdminIndex() {
  redirect("/admin/dashboard");
}
