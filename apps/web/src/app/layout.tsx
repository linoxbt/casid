import type { Metadata } from "next";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casid — Verified Economic Event Fabric",
  description:
    "Kafka + Stripe Webhooks for multi-chain economic truth on Flare. Attested topics, FDC proofs, FTSO thresholds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
