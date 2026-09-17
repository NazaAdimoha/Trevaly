import { z } from "zod";

import { WebhookStatus } from "../enums";

/** Query string of the platform's webhook-event (dead-letter) list. */
export const webhookEventsQuerySchema = z.object({
  status: z.enum(WebhookStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
