<script setup lang="ts">
/**
 * A person's name, linked to their profile — wherever that profile actually is.
 *
 * usePersonProfileLink() decides: our own /people/[id] normally, the HOST
 * platform's profile when we are running inside its iframe. This component only
 * renders that decision, so both the Invitees chips and the Attendance table get
 * the same behaviour from one place.
 *
 * ONE root element, via <component :is>, so the caller's `class` still falls
 * through — a v-if/v-else chain would make this multi-root and drop it, and every
 * call site styles this differently.
 *
 * Renders a plain <span> when there is nothing to link to (a guest with no person
 * row), rather than a dead link.
 */
const props = defineProps<{
  /** The person row. Either casing — the two tabs map the payload differently. */
  person?: any | null
  /** For callers holding only the id (the attendance table keys off person_id). */
  personId?: string | null
  /**
   * Render as plain text this time. For surfaces where a click means something
   * else — the invitee chips in select mode, where the click picks the person
   * for a bulk action and navigating away would be exactly wrong.
   */
  disabled?: boolean
}>()

const { profileLink } = usePersonProfileLink()
const NuxtLink = resolveComponent('NuxtLink')

const target = computed(() => (props.disabled ? {} : profileLink(props.person, props.personId)))
const tag = computed(() => (target.value.href ? 'a' : target.value.to ? NuxtLink : 'span'))
const bind = computed(() =>
  target.value.href
    // _top, not _self: the click has to navigate the HOST page, not this frame.
    ? { href: target.value.href, target: '_top' }
    : target.value.to
      ? { to: target.value.to }
      : {},
)
</script>

<template>
  <component :is="tag" v-bind="bind"><slot /></component>
</template>
