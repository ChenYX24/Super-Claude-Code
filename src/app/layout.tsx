import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import {
  LayoutDashboard,
  Users,
  Clock,
  Coins,
  FileEdit,
  Wrench,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Super Claude Code",
  description: "Claude Code Management Dashboard",
};

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/team", label: "Team Board", icon: Users },
  { href: "/sessions", label: "Sessions", icon: Clock },
  { href: "/tokens", label: "Tokens", icon: Coins },
  { href: "/toolbox", label: "Toolbox", icon: Wrench },
  { href: "/editor", label: "CLAUDE.md", icon: FileEdit },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col">
            <div className="font-bold text-lg mb-6 flex items-center gap-2">
              <span className="text-xl">⚡</span>
              Super Claude Code
            </div>
            <nav className="space-y-1 flex-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-xs text-muted-foreground">v0.4.0</span>
              <ThemeToggle />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
