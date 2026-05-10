import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a session — Moovli",
  description: "Book your studio session in just a few clicks.",
};

export default function PublicBookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="border-t border-border mt-16">
        <div className="mx-auto max-w-4xl px-4 py-4 text-xs text-muted-foreground text-center">
          Powered by{" "}
          <a href="https://moovli.app" className="text-primary hover:underline">
            Moovli
          </a>{" "}
          · Studio collects payment
        </div>
      </footer>
    </div>
  );
}
