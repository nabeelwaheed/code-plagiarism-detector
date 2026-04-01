import "./globals.css";
import type { Metadata } from "next";
import { QueryProvider } from "../components/query-provider";

export const metadata: Metadata = {
  title: "Similarity App",
  description: "Source-code similarity and plagiarism review",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
