import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { ThemedToaster } from "@/components/shell/ThemedToaster";
import { SidebarProvider } from "@/components/shell/sidebar-context";

// Runs before first paint to set the dark class from the saved/system
// preference, preventing a light flash on load.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wiz.AI BPO Outreach Automation",
  description:
    "AI-powered outreach automation for the Indonesian BPO industry",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <SidebarProvider>
          <div className="flex h-screen w-full overflow-hidden bg-bg">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        </SidebarProvider>
        <ThemedToaster />
      </body>
    </html>
  );
}
