// The client side of the seam for the person-types & fields domain. Components call
// this — never useDb(), never Supabase, never $fetch to a raw table. It returns
// fully-typed domain objects (the shared contract), so a component has no idea
// whether the data came from MySQL today or the backend team's API tomorrow.
import type {
  PersonType,
  PersonTypeCreate,
  PersonTypePatch,
  FieldDefinition,
  FieldDefinitionCreate,
  FieldDefinitionPatch,
  PersonTypeLink,
} from '../shared/contracts/personType'

export function usePersonTypesApi() {
  /** The person/entity types an org defines (Member/Player, Parent, Team…). */
  async function listTypes(orgId: string): Promise<PersonType[]> {
    return await $fetch<PersonType[]>('/api/v1/person-types', { query: { orgId } })
  }
  /** Create a person/entity type; returns the created domain object. */
  async function createType(input: PersonTypeCreate): Promise<PersonType> {
    return await $fetch<PersonType>('/api/v1/person-types', { method: 'POST', body: input })
  }
  /** Partially update a person/entity type; returns the updated domain object. */
  async function updateType(id: string, patch: PersonTypePatch): Promise<PersonType> {
    return await $fetch<PersonType>(`/api/v1/person-types/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a person/entity type. */
  async function removeType(id: string): Promise<void> {
    await $fetch(`/api/v1/person-types/${id}`, { method: 'DELETE' })
  }
  /** The custom-field library for an org. */
  async function listFields(orgId: string): Promise<FieldDefinition[]> {
    return await $fetch<FieldDefinition[]>('/api/v1/field-definitions', { query: { orgId } })
  }
  /** Create a custom field; returns the created domain object. */
  async function createField(input: FieldDefinitionCreate): Promise<FieldDefinition> {
    return await $fetch<FieldDefinition>('/api/v1/field-definitions', { method: 'POST', body: input })
  }
  /** Partially update a custom field; returns the updated domain object. */
  async function updateField(id: string, patch: FieldDefinitionPatch): Promise<FieldDefinition> {
    return await $fetch<FieldDefinition>(`/api/v1/field-definitions/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a custom field. */
  async function removeField(id: string): Promise<void> {
    await $fetch(`/api/v1/field-definitions/${id}`, { method: 'DELETE' })
  }
  /** Inheritance edges — a type sourced from an ancestor's type. */
  async function listLinks(orgId: string): Promise<PersonTypeLink[]> {
    return await $fetch<PersonTypeLink[]>('/api/v1/person-type-links', { query: { orgId } })
  }
  return {
    listTypes, createType, updateType, removeType,
    listFields, createField, updateField, removeField,
    listLinks,
  }
}
