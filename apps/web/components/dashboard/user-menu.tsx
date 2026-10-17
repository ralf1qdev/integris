"use client";

import { LogOut, LayoutGrid } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/client-api";
import { Avatar, initials } from "./avatar";

export function UserMenu({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const router = useRouter();
  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface-2" aria-label="Account menu">
        <Avatar src={avatarUrl} alt="" fallback={initials(name)} className="size-7" />
        <span className="hidden max-w-32 truncate text-sm sm:block">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Signed in as {name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/dashboard")}>
          <LayoutGrid /> All servers
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
