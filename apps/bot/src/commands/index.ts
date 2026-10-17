import { alerts } from "./alerts";
import { bots } from "./bots";
import { dashboard } from "./dashboard";
import { scan } from "./scan";
import { security } from "./security";
import { setup } from "./setup";
import type { Command } from "./types";
import { webhooks } from "./webhooks";

export const commands: Command[] = [security, scan, bots, webhooks, alerts, dashboard, setup];
export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
