import "./globals.css";
import type { Metadata } from "next";
import { QueryProvider } from "../components/query-provider";
import { ToastProvider } from "../components/toast-provider";
import { GlobalHeader } from "../components/global-header";
import { GlobalFooter } from "../components/global-footer";

export const metadata: Metadata = {
  title: "Anti-Vibe Coder — Academic Integrity Platform",
  description: "Source-code similarity analysis for academic integrity review",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <ToastProvider>
            <div className="app-layout">
              <GlobalHeader />
              <main className="app-main">{children}</main>
              <GlobalFooter />
            </div>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
