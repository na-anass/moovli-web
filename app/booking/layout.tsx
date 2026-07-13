import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("booking");
  return {
    title: t("page.metaTitle"),
    description: t("page.metaDescription"),
  };
}

export default async function PublicBookingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("booking");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="border-t border-border mt-16">
        <div className="mx-auto max-w-4xl px-4 py-4 text-xs text-muted-foreground text-center">
          {t("page.poweredBy")}{" "}
          <a href="https://moovli.app" className="text-primary hover:underline">
            Moovli
          </a>{" "}
          · {t("page.studioCollectsPayment")}
        </div>
      </footer>
    </div>
  );
}
