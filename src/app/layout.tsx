import type { Metadata } from "next";
import "./globals.css";
import { FinoraProvider } from "@/context/FinoraContext";

export const metadata: Metadata = {
  title: "Finora — AI Wealth Engine & Personal Finance",
  description:
    "AI-powered personal finance management SaaS with Virtual Bank simulator and Gemini Intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background font-sans text-on-surface antialiased min-h-screen selection:bg-primary-container selection:text-on-primary-container">
        <FinoraProvider>{children}</FinoraProvider>
      </body>
    </html>
  );
}
