import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppNav from "./_components/AppNav";
import { LocaleProvider } from "./_lib/locale-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Card Emergency Support",
  description: "AI-first emergency card support for a synthetic LATAM bank.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <LocaleProvider>
          <AppNav />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
