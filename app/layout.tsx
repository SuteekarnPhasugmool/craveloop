import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CraveLoop — A good meal for everyone",
  description:
    "Find a shared meal with a workable menu for every friend. Synthetic catalog prototype.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
