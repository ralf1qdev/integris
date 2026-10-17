import "server-only";
import { getPrisma } from "@integris/database";

export const db = getPrisma();
