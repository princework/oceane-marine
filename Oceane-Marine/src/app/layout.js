import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalNotificationBell from "./components/GlobalNotificationBell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional", // Prevents blocking on font load failure
  fallback: ["system-ui", "arial"], // Fallback fonts
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "optional", // Prevents blocking on font load failure
  fallback: ["monospace"], // Fallback fonts
});

export const metadata = {
  title: "HELIOS TECH LABS",
  description: "STS Management System",
  icons: {
    icon: [
      { url: "/image/image.png", sizes: "any", type: "image/png" },
      { url: "/image/image.png", sizes: "32x32", type: "image/png" },
      { url: "/image/image.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/image/image.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen overflow-x-hidden`}
        suppressHydrationWarning
      >
        {children}
        <GlobalNotificationBell />
      </body>
    </html>
  );
}
