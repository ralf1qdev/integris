import { userAvatarUrl } from "@integris/shared";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/dashboard/user-menu";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const name = session.user.globalName ?? session.user.username;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo href="/dashboard" />
          <UserMenu name={name} avatarUrl={userAvatarUrl(session.user.id, session.user.avatar)} />
        </div>
      </header>
      {children}
    </div>
  );
}
