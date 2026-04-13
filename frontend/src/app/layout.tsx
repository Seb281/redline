import type { Metadata } from "next";
import { Lora, DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CookieBanner } from "@/components/CookieBanner";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

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
    <html lang="en" suppressHydrationWarning className={`${lora.variable} ${dmSans.variable}`}>
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased theme-transition font-[var(--font-body)]">
        <AuthProvider>
          <Header />
          {children}
          <Footer />
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
