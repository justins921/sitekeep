import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is the robust fallback; Satoshi (the site's real face) loads via Fontshare in globals.css.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SiteKeep — Website done. Client gone? Not with SiteKeep.",
  description:
    "SiteKeep gives web designers & agencies the tools to keep clients long after launch and monetize maintenance every month.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
