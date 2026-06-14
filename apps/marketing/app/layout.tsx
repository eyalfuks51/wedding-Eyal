import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Guesto | הזמנה דיגיטלית לחתונה",
    template: "%s | Guesto",
  },
  description:
    "יוצרים הזמנה דיגיטלית יפה לחתונה, משתפים בווטסאפ, ומנהלים אישורי הגעה במקום אחד בלי אקסלים מבולגנים.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Guesto | הזמנה דיגיטלית לחתונה",
    description:
      "הזמנה יפה, קישור לווטסאפ, וניהול אישורי הגעה מסודר לחתונה שלכם.",
    url: "/",
    siteName: "Guesto",
    type: "website",
    locale: "he_IL",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "oklch(0.97 0.012 292)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
