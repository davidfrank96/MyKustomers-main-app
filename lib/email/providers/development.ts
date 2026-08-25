import "server-only";
import { randomUUID } from "node:crypto";
import type { TransactionalEmailProvider } from "@/lib/email/types";

export const developmentEmailProvider: TransactionalEmailProvider = {
  name: "development",
  async send() {
    return {
      status: "sent",
      messageId: `development-${randomUUID()}`,
    };
  },
};
