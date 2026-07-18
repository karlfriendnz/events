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
  ResolvedField,
  ResolvedPersonType,
  OrgTypeFull,
  LinkableType,
  HydratedTypeLink,
  TypeByKey,
  ProfileForm,
  CoreFieldsConfig,
  TerminologyMap,
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

  // ── Resolved views (own + inherited) ──
  // The CALLER resolves the org-id list (org + its governing/ancestor chain — the
  // org-hierarchy layer owns that walk) and passes it as a CSV; the seam reads their
  // rows and tags provenance. `focusOrgId` is the org doing the looking.
  /** Own + inherited field definitions for an org's governing chain. */
  async function resolveFields(orgIds: string[], focusOrgId: string): Promise<ResolvedField[]> {
    return await $fetch<ResolvedField[]>('/api/v1/field-definitions/resolve', {
      query: { orgIds: orgIds.join(','), focusOrgId },
    })
  }
  /** Own + inherited person types for an org's ancestor chain. */
  async function resolvePersonTypes(orgIds: string[], focusOrgId: string): Promise<ResolvedPersonType[]> {
    return await $fetch<ResolvedPersonType[]>('/api/v1/person-types/resolve', {
      query: { orgIds: orgIds.join(','), focusOrgId },
    })
  }
  /** A club's OWN types with the full setup config (no inheritance). */
  async function listOrgTypes(orgId: string): Promise<OrgTypeFull[]> {
    return await $fetch<OrgTypeFull[]>('/api/v1/person-types/org-types', { query: { orgId } })
  }
  /** The label + member-slots of the type matching a key across [org + ancestors]. */
  async function typeByKey(orgIds: string[], key: string): Promise<TypeByKey> {
    return await $fetch<TypeByKey>('/api/v1/person-types/by-key', { query: { orgIds: orgIds.join(','), key } })
  }
  /** The PUBLISHED types of a set of governing orgs — the linkable set. */
  async function linkableTypes(orgIds: string[]): Promise<LinkableType[]> {
    return await $fetch<LinkableType[]>('/api/v1/person-types/published', { query: { orgIds: orgIds.join(',') } })
  }
  /** Hydrated inheritance links across the reachable set (org + governing chain). */
  async function typeLinksHydrated(orgIds: string[]): Promise<HydratedTypeLink[]> {
    return await $fetch<HydratedTypeLink[]>('/api/v1/person-type-links/hydrated', { query: { orgIds: orgIds.join(',') } })
  }
  /** Idempotently link a club type to a governing body's type. */
  async function linkType(orgId: string, typeId: string, sourceTypeId: string): Promise<void> {
    await $fetch('/api/v1/person-type-links', { method: 'POST', body: { orgId, typeId, sourceTypeId } })
  }
  /** Remove an inheritance link. */
  async function unlinkType(linkId: string): Promise<void> {
    await $fetch(`/api/v1/person-type-links/${linkId}`, { method: 'DELETE' })
  }

  // ── Profile form layout ──
  /** The form layout for one person type (null when none saved). */
  async function getProfileForm(orgId: string, typeKey: string): Promise<ProfileForm> {
    return await $fetch<ProfileForm>('/api/v1/profile-forms', { query: { orgId, typeKey } })
  }
  /** Upsert the form layout for one person type. */
  async function saveProfileForm(orgId: string, typeKey: string, config: Record<string, any>): Promise<void> {
    await $fetch('/api/v1/profile-forms', { method: 'POST', body: { orgId, typeKey, config } })
  }

  // ── Org-level field settings ──
  /** The org's global core-fields config ({ required, enabled }). */
  async function getCoreFields(orgId: string): Promise<CoreFieldsConfig> {
    return await $fetch<CoreFieldsConfig>('/api/v1/core-fields', { query: { orgId } })
  }
  async function saveCoreFields(orgId: string, config: CoreFieldsConfig): Promise<void> {
    await $fetch('/api/v1/core-fields', { method: 'POST', body: { orgId, config } })
  }
  /** Terminology overrides for a set of orgs (org + ancestors). */
  async function terminologyForOrgs(orgIds: string[]): Promise<{ orgId: string; terminology: TerminologyMap }[]> {
    return await $fetch('/api/v1/terminology', { query: { orgIds: orgIds.join(',') } })
  }
  /** A sport's terminology overrides (explicit sport, or the primary when omitted). */
  async function sportTerminology(orgId: string, sportId?: string | null): Promise<TerminologyMap | null> {
    const query: Record<string, string> = { orgId }
    if (sportId) query.sportId = sportId
    return await $fetch<TerminologyMap | null>('/api/v1/terminology/sport', { query })
  }
  async function saveOrgTerminology(orgId: string, overrides: TerminologyMap): Promise<void> {
    await $fetch('/api/v1/terminology/org', { method: 'POST', body: { orgId, overrides } })
  }
  async function saveSportTerminology(sportId: string, overrides: TerminologyMap): Promise<void> {
    await $fetch('/api/v1/terminology/sport', { method: 'POST', body: { sportId, overrides } })
  }

  return {
    listTypes, createType, updateType, removeType,
    listFields, createField, updateField, removeField,
    listLinks,
    resolveFields, resolvePersonTypes, listOrgTypes, typeByKey, linkableTypes,
    typeLinksHydrated, linkType, unlinkType,
    getProfileForm, saveProfileForm,
    getCoreFields, saveCoreFields, terminologyForOrgs, sportTerminology,
    saveOrgTerminology, saveSportTerminology,
  }
}
