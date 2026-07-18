// The recipe catalogue. Adding a recipe = import it + list it here. Nothing else in
// the engine needs to change — the endpoints, the composable and the UI all read
// this list.
import type { SeedRecipe } from './types'
import { demoEventsRecipe } from './recipes/demo-events'
import { nsoHierarchyRecipe } from './recipes/nso-hierarchy'
import { multiSportClubRecipe } from './recipes/multi-sport-club'
import { clubByTypeRecipe } from './recipes/club-by-type'

export const SEED_RECIPES: SeedRecipe[] = [
  demoEventsRecipe,
  nsoHierarchyRecipe,
  multiSportClubRecipe,
  clubByTypeRecipe,
]

export function getRecipe(key: string): SeedRecipe | undefined {
  return SEED_RECIPES.find((r) => r.key === key)
}
