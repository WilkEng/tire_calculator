"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <nav className="flex items-center gap-1 bg-gray-900 px-4 py-2 border-b border-gray-700">
      <span className="text-lg font-bold text-white mr-6 tracking-tight">
        Tire Calc
      </span>
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
              px-3 py-1.5 rounded text-sm font-medium transition-colors
              ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
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
