import { z } from 'zod'

export const publicPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export const selectionIdSchema = z.string().min(1).max(4096)

export const locationSelectionInputSchema = z.discriminatedUnion('precision', [
  z.object({ selectionId: selectionIdSchema, precision: z.literal('approximate') }),
  z.object({
    selectionId: selectionIdSchema,
    precision: z.literal('precise'),
    confirmedPublicPoint: publicPointSchema,
    preciseLocationConfirmed: z.literal(true),
  }),
])

export type LocationSelectionInput = z.infer<typeof locationSelectionInputSchema>

export const locationSelectionSchema = z.object({
  locality: z.string().min(1),
  country: z.string().min(1),
  countryCode: z.string().length(2),
  point: publicPointSchema,
  attribution: z.string(),
})

export type LocationSelection = z.infer<typeof locationSelectionSchema>
