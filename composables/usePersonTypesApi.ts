// The client side of the seam for the person-types & fields domain. Components call
// this — never useDb(), never Supabase, never $fetch to a raw table. It returns
// fully-typed domain objects (the shared contract), so a component has no idea
// whether the data came from MySQL today or the backend team's API tomorrow.
import type {
  PersonType,
  FieldDefinition,
  PersonTypeLink,
} from '../shared/contracts/personType'

export function usePersonTypesApi() {
  /** The person/entity types an org defines (Member/Player, Parent, Team…). */
  async function listTypes(orgId: string): Promise<PersonType[]> {
    return await $fetch<PersonType[]>('/api/v1/person-types', { query: { orgId } })
  }
  /** The custom-field library for an org. */
  async function listFields(orgId: string): Promise<FieldDefinition[]> {
    return await $fetch<FieldDefinition[]>('/api/v1/field-definitions', { query: { orgId } })
  }
  /** Inheritance edges — a type sourced from an ancestor's type. */
  async function listLinks(orgId: string): Promise<PersonTypeLink[]> {
    return await $fetch<PersonTypeLink[]>('/api/v1/person-type-links', { query: { orgId } })
  }
  return { listTypes, listFields, listLinks }
}
