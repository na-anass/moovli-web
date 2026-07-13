import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("forgotPassword.comingSoon")}</h1>
      <p className="text-muted-foreground">{t("forgotPassword.underConstruction")}</p>
    </div>
  );
}
