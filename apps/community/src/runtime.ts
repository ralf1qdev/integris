import { getPrisma } from "@integris/database";
import { createLogger } from "@integris/shared/logger";

export const log = createLogger("community");
export const db = getPrisma();
