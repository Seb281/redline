import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Redline — AI Contract Analyzer",
  description: "Upload a contract. Understand what you're signing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased theme-transition`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
