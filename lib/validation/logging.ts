import { z } from "zod";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "custom"] as const;
export const LOG_SOURCES = [
  "manual",
  "photo_ai",
  "barcode",
  "voice",
  "text",
  "saved_meal",
  "recipe",
  "search",
] as const;

export const createLogSchema = z.object({
  foodId: z.string().uuid("Invalid food id"),
  quantity: z
    .number({ message: "Quantity must be a number" })
    .positive("Quantity must be greater than 0")
    .max(100000, "That quantity looks wrong"),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  mealType: z.enum(MEAL_TYPES).optional(),
  loggedAt: z
    .string()
    .datetime({ offset: true, message: "Invalid date/time" })
    .optional(),
  source: z.enum(LOG_SOURCES).optional(),
  confidence: z.number().min(0).max(1).nullish(),
  aiAnalysisId: z.string().uuid().nullish(),
  aiMetadata: z.record(z.string(), z.unknown()).nullish(),
});

export const editLogSchema = z
  .object({
    quantity: z.number().positive().max(100000).optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    mealType: z.enum(MEAL_TYPES).optional(),
    loggedAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, "Type at least 2 characters").max(80),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const barcodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6,14}$/, "Barcode must be 6–14 digits");

export type CreateLogInputValidated = z.infer<typeof createLogSchema>;
export type EditLogInputValidated = z.infer<typeof editLogSchema>;
