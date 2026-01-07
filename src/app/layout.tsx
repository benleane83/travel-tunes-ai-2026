import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Travel Planner",
  description: "Plan your event trips with AI-powered flight and hotel recommendations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
