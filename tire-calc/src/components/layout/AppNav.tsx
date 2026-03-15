"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "⊞" },
  { href: "/planner", label: "Planner", icon: "◎" },
  { href: "/temperature", label: "Temps", icon: "🌡" },
  { href: "/history", label: "History", icon: "▤" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 bg-gray-900/95 backdrop-blur-sm px-4 py-2 border-b border-gray-700/50 sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2 mr-6">
        <Image
          src="/logo-white.svg"
          alt="Wilkinson Engineering"
          width={28}
          height={28}
          className="h-7 w-auto"
        />
        <span className="text-sm font-bold text-white tracking-tight hidden sm:inline">
          Tire Calc
        </span>
      </Link>
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${
                active
                  ? "bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/20"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent"
              }
            `}
          >
            <span className="mr-1">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
