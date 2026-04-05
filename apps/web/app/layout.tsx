import "./globals.css";
import type { Metadata } from "next";
import { QueryProvider } from "../components/query-provider";
import { ToastProvider } from "../components/toast-provider";

export const metadata: Metadata = {
  title: "Anti-Vibe Coder",
  description: "Academic source-code similarity review platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
