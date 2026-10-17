import { Check } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pricing" };

const INCLUDED = [
  "Unlimited servers you manage",
  "Bot permission and role-hierarchy analysis",
  "Webhook inventory, approval and protection",
  "Discord alert delivery with acknowledge / resolve buttons",
  "Activity history with configurable retention",
  "All slash commands",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Free during the beta</h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-muted">Every feature is available at no cost while Integris is in beta. There is no payment method to enter.</p>
      <div className="card mx-auto mt-12 max-w-md p-8 text-left">
        <p className="text-sm font-medium text-secondary">Beta</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">
          $0 <span className="text-base font-normal text-muted">/ month</span>
        </p>
        <ul className="mt-6 space-y-2.5">
          {INCLUDED.map((i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-healthy" /> {i}
            </li>
          ))}
        </ul>
        <Button className="mt-8 w-full" size="lg" asChild>
          <a href="/invite">Add to Discord</a>
        </Button>
      </div>
      <p className="mx-auto mt-8 max-w-lg text-sm text-muted">
        When paid plans are introduced, beta users will be notified in advance. Plans will never limit access to security findings for servers you already protect.
      </p>
    </div>
  );
}
