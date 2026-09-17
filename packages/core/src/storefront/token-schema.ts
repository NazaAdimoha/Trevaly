import { z } from "zod";

import { DENSITIES, MEDIA_RATIOS, type TokenOverrides } from "./tokens";

/**
 * Validation for a merchant's token overrides.
 *
 * Separate from `./tokens` on purpose — see the note on `TokenOverrides`. The
 * API and the editor import this; the storefront imports only the maths.
 */
export const tokenOverridesSchema = z
  .object({
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour like #4DBF7D")
      .nullable()
      .optional(),
    density: z.enum(DENSITIES).optional(),
    mediaRatio: z.enum(MEDIA_RATIOS).optional(),
    mediaFit: z.enum(["cover", "contain"]).optional(),
  })
  .strict() satisfies z.ZodType<TokenOverrides, unknown>;
