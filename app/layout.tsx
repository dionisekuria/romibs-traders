import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROMIBS Traders | Little pieces, big days",
  description: "Comfortable baby and children's essentials for ages 10 and under in Kenya.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
