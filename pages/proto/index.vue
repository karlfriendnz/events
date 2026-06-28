<!--
  PROTOTYPE hub — explains the "two screens, one engine" model and links into it.
-->
<script setup lang="ts">
const cards = [
  { to: '/proto/people-types', icon: 'pi-id-card', title: 'People types', desc: 'Members, coaches, committee… their fields, layout and permissions.' },
  { to: '/proto/entity-types', icon: 'pi-sitemap', title: 'Teams & organisations', desc: 'Teams, businesses, schools, families… their fields, layout and members.' },
  { to: '/proto/people', icon: 'pi-users', title: 'People', desc: 'The person records — viewable per type from the menu.' },
  { to: '/proto/organisations', icon: 'pi-building', title: 'Organisations', desc: 'The entity records, with their attached people.' },
]
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <ProtoNav />
      <div class="flex-1 min-w-0 max-w-3xl">
        <div class="mb-5">
          <span class="text-[10px] font-bold uppercase tracking-widest text-amber-500">Prototype</span>
          <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 mt-1">People, Entities &amp; Access</h1>
          <p class="text-sm text-gray-500 mt-1 max-w-xl">Two screens, one engine. People and entities are both records with custom fields, a profile layout and reports — people add <strong>permissions</strong>, entities add a <strong>roster</strong>. People connect to entities through roles.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NuxtLink v-for="c in cards" :key="c.to" :to="c.to" class="card p-4 hover:shadow-md transition-shadow flex gap-3 items-start">
            <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <i :class="['pi', c.icon, 'text-primary']" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-gray-900">{{ c.title }}</p>
              <p class="text-xs text-gray-500 mt-0.5">{{ c.desc }}</p>
            </div>
          </NuxtLink>
        </div>

        <div class="mt-5 card p-4 bg-amber-50/40 border-amber-100">
          <p class="text-sm text-gray-700"><strong>How to try it:</strong></p>
          <ol class="text-sm text-gray-600 mt-1.5 space-y-1 list-decimal pl-5">
            <li>In <strong>Teams &amp; organisations</strong>, add an entity type (e.g. Team) and define its Members (Players, Coaches…).</li>
            <li>In <strong>Organisations</strong>, create a Team and attach people to it in the People tab.</li>
            <li>Use the left menu — each people type and entity type is its own view.</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>
