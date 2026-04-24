import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthenticationProvider } from "@/app/_context/authentication"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { Toaster } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Panel",
  description: "Panel management dashboard",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const envScript = `window.__ENV__=${JSON.stringify({ NEXT_PUBLIC_API_URL: apiUrl })};`;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: envScript }} />
      </head>
      <body className="h-svh overflow-hidden">
        <ThemeProvider>
          <TooltipProvider>
            <AuthenticationProvider>
              {children}
              <Toaster />
            </AuthenticationProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
