import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("booking");
  return {
    title: t("embed.metaTitle"),
    robots: { index: false, follow: false },
  };
}

/**
 * Stripped-chrome layout for the embeddable widget.
 * No outer header/footer — meant to be iframed into a third-party site.
 */
export default async function EmbedLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("booking");
  return (
    <div className="bg-background text-foreground p-3">
      {children}
      <div className="text-center text-[10px] text-muted-foreground mt-3">
        {t("page.poweredBy")}{" "}
        <a
          href="https://moovli.app"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          Moovli
        </a>
      </div>
    </div>
  );
}
