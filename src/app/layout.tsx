import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { SessionContextProvider } from "@/components/session-context-provider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { SuppressWarnings } from "@/components/suppress-warnings"; // Importar el nuevo componente

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Chat App",
  description: "Chat with Claude AI models using Puter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SuppressWarnings /> {/* Añadir el componente aquí */}
        <Script 
          src="https://js.puter.com/v2/" 
          strategy="beforeInteractive"
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionContextProvider>
            {children}
          </SessionContextProvider>
          <Toaster
            position="top-right" // Cambiado a top-right
            toastOptions={{
              classNames: {
                info: "bg-info text-info-foreground border-blue-500",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}