"use client";

import { ACTIVITY_RANGES, type ActivityRange } from "@integris/shared";
import { Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

interface Point {
  bucket: string;
  events: number;
  alerts: number;
}

const LABEL: Record<ActivityRange, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };

function tick(range: ActivityRange, iso: string) {
  const d = new Date(iso);
  return range === "24h"
    ? d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
    : d.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function ActivityChart({ guildId }: { guildId: string }) {
  const [range, setRange] = useState<ActivityRange>("7d");
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    setError(false);
    api<{ points: Point[] }>(`/api/guilds/${guildId}/activity?range=${range}`)
      .then((r) => !cancelled && setPoints(r.points))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [guildId, range]);

  const total = points?.reduce((n, p) => n + p.events + p.alerts, 0) ?? 0;

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div>
          <h3 className="text-sm font-semibold">Security activity</h3>
          <p className="mt-1 text-[13px] text-muted">Recorded events and raised alerts over the last {LABEL[range]} (UTC).</p>
        </div>
        <div role="tablist" aria-label="Time range" className="flex rounded-lg border border-border bg-background p-0.5">
          {ACTIVITY_RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", range === r ? "bg-surface-3 text-foreground" : "text-muted hover:text-foreground")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 px-2 pb-4 pt-4">
        {error ? (
          <p className="grid h-full place-items-center text-sm text-muted">Activity could not be loaded.</p>
        ) : !points ? (
          <Skeleton className="mx-3 h-full" />
        ) : total === 0 ? (
          <EmptyState icon={Activity} title="No activity in this period" description="Events appear here as Integris observes bot, role and webhook changes." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="ev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5865F2" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5865F2" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="al" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#222937" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={(v: string) => tick(range, v)} stroke="#5C6479" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} stroke="#5C6479" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#11151D", border: "1px solid #222937", borderRadius: 10, fontSize: 12 }}
                labelFormatter={(v) => tick(range, String(v))}
                cursor={{ stroke: "#2E3647" }}
              />
              <Area type="monotone" dataKey="events" name="Events" stroke="#818CF8" strokeWidth={2} fill="url(#ev)" />
              <Area type="monotone" dataKey="alerts" name="Alerts" stroke="#F59E0B" strokeWidth={2} fill="url(#al)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
