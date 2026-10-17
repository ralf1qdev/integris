import { getPrisma } from "@integris/database";

export const db = getPrisma();

/** The Integris bot's own user ID, resolved at startup. */
export const self = { id: "" };
