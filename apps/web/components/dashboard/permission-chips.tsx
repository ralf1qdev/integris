import { DANGEROUS_PERMISSIONS } from "@integris/security/dangerous";
import { has, Permission, PERMISSION_LABELS, permissionNames, toBits } from "@integris/security/permissions";
import { Badge } from "@/components/ui/badge";

const DANGEROUS = new Set(DANGEROUS_PERMISSIONS.map((d) => d.name));

/** Highlights security-relevant permissions; the rest are summarised. */
export function PermissionChips({ permissions, max = 4 }: { permissions: string; max?: number }) {
  const bits = toBits(permissions);
  if (has(bits, Permission.Administrator)) return <Badge tone="critical">Administrator</Badge>;
  const names = permissionNames(bits);
  const risky = names.filter((n) => DANGEROUS.has(n));
  const rest = names.length - risky.length;
  if (!risky.length) return <span className="text-xs text-muted">{names.length ? `${names.length} standard permissions` : "No permissions"}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {risky.slice(0, max).map((n) => (
        <Badge key={n} tone="warning">
          {PERMISSION_LABELS[n]}
        </Badge>
      ))}
      {risky.length > max ? <Badge>+{risky.length - max}</Badge> : null}
      {rest > 0 ? <span className="self-center text-xs text-subtle">+{rest} standard</span> : null}
    </div>
  );
}
