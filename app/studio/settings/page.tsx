import { redirect } from "next/navigation";

export default function SettingsIndexPage() {
  redirect("/studio/settings/general");
}
