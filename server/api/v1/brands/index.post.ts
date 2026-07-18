// POST /api/v1/brands — create a platform brand (super-admin Master). Global
// master data (no org scope). Validates input + parses output against the contract.
import { createBrand } from '../../../db/repositories/admin'
import { brandCreateSchema, brandSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async (event) => {
  const input = brandCreateSchema.parse(await readBody(event))
  const brand = await createBrand(input)
  return brandSchema.parse(brand)
})
