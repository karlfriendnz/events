<!--
  The "these people don't meet what the discipline requires" band on a group roster.
  One component, rendered above BOTH the coaches and the members bands, so the two
  can't drift apart in wording.

  AMBER, deliberately, and not the blue of the shortfall bands beside it: blue means
  "your own config isn't finished" (a staff/position minimum you fix in settings);
  this is member data failing a governing body's rule. Amber is already what the
  rest of the app means by required-data-missing.

  It never blocks anything — the whole model is flags only — so the row says so.
-->
<script setup lang="ts">
defineProps<{
  colspan: number
  summary: { people: number; fields: { label: string; count: number }[] }
  /** The discipline(s) the group is linked to — the name the club recognises,
   *  rather than the ancestor a rule was authored on (the per-person popover names
   *  that). */
  disciplineName: string
  noun: string
  nounPlural: string
}>()
</script>

<template>
  <tr v-if="summary.people">
    <td :colspan="colspan" class="px-5 py-2 text-xs bg-amber-50 text-amber-800" style="border-left:4px solid #F59E0B">
      <i class="pi pi-exclamation-triangle text-xs mr-1" />
      <span class="font-semibold">{{ summary.people }}</span>
      {{ summary.people === 1 ? noun : nounPlural }}
      {{ summary.people === 1 ? "doesn't meet" : "don't meet" }}
      what <span class="font-semibold">{{ disciplineName }}</span> requires —
      <span v-for="(f, i) in summary.fields" :key="f.label">{{ i ? ', ' : '' }}{{ f.label }} ({{ f.count }})</span>.
      <span class="text-amber-600">Nothing is blocked.</span>
    </td>
  </tr>
</template>
