import "./globals.css";
import type { Metadata } from "next";
import { QueryProvider } from "../components/query-provider";
import { GlobalShell } from "../components/global-shell";

export const metadata: Metadata = {
  title: "Anti-Vibe Coder — Code Similarity Platform",
  description: "Source-code similarity and academic integrity review",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <GlobalShell>{children}</GlobalShell>
        </QueryProvider>
      </body>
    </html>
  );
}
