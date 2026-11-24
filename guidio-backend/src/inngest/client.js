import { Inngest } from "inngest";
import { env } from "../config/env.js";

// In production, set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY. The SDK reads
// both from the environment automatically. INNGEST_DEV=1 is for local use only.
export const inngest = new Inngest({
  id: "guidio-ai",
  isDev: env.inngestDev,
});