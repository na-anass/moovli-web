import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moovli embed",
  robots: { index: false, follow: false },
};

/**
 * Stripped-chrome layout for the embeddable widget.
 * No outer header/footer — meant to be iframed into a third-party site.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground p-3">
      {children}
      <div className="text-center text-[10px] text-muted-foreground mt-3">
        Powered by{" "}
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
