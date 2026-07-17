// GET /api/v1/brands — the platform brand catalogue. Global master data: NO org
// scope, every club draws from the same list. Output is validated against the
// shared contract before it leaves, guaranteeing the client's types.
import { listBrands } from '../../../db/repositories/admin'
import { brandListSchema } from '../../../../shared/contracts/admin'

export default defineEventHandler(async () => {
  const brands = await listBrands()
  return brandListSchema.parse(brands)
})
