"use client";

import { Activity, Bell, Bot, LayoutDashboard, Link2, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/bots", label: "Bots", icon: Bot },
  { href: "/webhooks", label: "Webhooks", icon: Link2 },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ guildId, openAlerts }: { guildId: string; openAlerts: number }) {
  const pathname = usePathname();
  const base = `/dashboard/${guildId}`;
  return (
    <nav aria-label="Server navigation" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const full = base + href;
        const active = href === "" ? pathname === base : pathname.startsWith(full);
        return (
          <Link
            key={label}
            href={full}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-surface-2 text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]" : "text-muted hover:bg-surface-2/60 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4", active ? "text-secondary" : "text-subtle")} />
            {label}
            {label === "Alerts" && openAlerts > 0 ? (
              <span className="ml-auto rounded-full bg-critical/15 px-1.5 text-[11px] font-medium tabular-nums text-critical">{openAlerts}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
