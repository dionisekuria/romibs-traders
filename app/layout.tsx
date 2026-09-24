import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROMIBS Traders | Little pieces, big days",
  description: "Comfortable baby and children's essentials for ages 10 and under in Kenya.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  keywords: ["children's clothing", "baby essentials", "kids clothing Kenya", "ROMIBS Traders"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: "/",
    siteName: "ROMIBS Traders",
    title: "ROMIBS Traders | Little pieces, big days",
    description: "Comfortable baby and children's essentials for ages 10 and under in Kenya.",
  },
  twitter: {
    card: "summary",
    title: "ROMIBS Traders | Little pieces, big days",
    description: "Comfortable baby and children's essentials for ages 10 and under in Kenya.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
