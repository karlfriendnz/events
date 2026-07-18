<!--
  Term setup wizard — guides a club through standing up a term end-to-end,
  whether or not any term exists yet: create/pick the term → sign-up window →
  roll classes over → fees → registration & comms → summary → one-click create.
  Entry points: the dashboard rollover nudge banner + /groups/rollover.
  The detailed per-class screen (/groups/rollover) remains for power users.
-->
<template>
  <div class="w-full p-3 sm:p-6">
    <div class="space-y-4">

      <div v-if="loading" class="text-sm text-gray-400 py-8 text-center">Loading…</div>

      <!-- DONE -->
      <div v-else-if="done" class="card p-8 text-center space-y-4">
        <span class="w-14 h-14 rounded-full bg-emerald-100 inline-flex items-center justify-center"><i class="pi pi-check text-emerald-600 text-2xl" /></span>
        <h2 class="text-lg sm:text-2xl font-semibold text-gray-900">{{ targetName }} is ready</h2>
        <ul class="text-sm text-gray-600 space-y-1">
          <li v-if="result.created"><b class="font-semibold">{{ result.created }}</b> {{ result.created === 1 ? classS : classP }} carried over — coaches on {{ staffCarryCount }}, members on {{ memberCarryCount }}</li>
          <li v-if="result.events"><b class="font-semibold">{{ result.events }}</b> training session{{ result.events === 1 ? '' : 's' }} added to the calendar, class lists ready for attendance</li>
          <li v-if="result.feesAdded">Fees updated on <b class="font-semibold">{{ result.feesAdded }}</b> class{{ result.feesAdded === 1 ? '' : 'es' }}</li>
          <li>Sign-ups {{ signupOpen ? `open ${fmtDate(signupOpen)}` : 'are open now' }} and close {{ signupClose ? fmtDate(signupClose) : `when the ${termS} ends` }}</li>
        </ul>
        <div class="flex items-center justify-center gap-2 pt-2">
          <Button :label="`View ${classP}`" size="small" style="background:#1E2157;border-color:#1E2157" @click="navigateTo('/groups')" />
          <Button label="Back to dashboard" size="small" text @click="navigateTo('/dashboard')" />
        </div>
      </div>

      <template v-else>
        <div v-if="!sourceTerm" class="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-900">
          No {{ termP }} yet — let's set up your first one from scratch.
        </div>

        <!-- Step indicator — visited steps are clickable -->
        <div class="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar px-1 py-1">
          <template v-for="(s, i) in steps" :key="s.n">
            <button type="button" class="flex items-center gap-2 shrink-0" :class="s.n <= revealed ? 'cursor-pointer' : 'cursor-default'"
              @click="s.n <= revealed && goTo(s.n)">
              <span class="w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors"
                :class="current > s.n ? 'bg-emerald-500 text-white' : current === s.n ? 'text-white' : 'bg-gray-200 text-gray-500'"
                :style="current === s.n ? 'background:#1E2157' : ''">
                <i v-if="current > s.n" class="pi pi-check text-[9px]" />
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span class="text-xs font-medium whitespace-nowrap" :class="current >= s.n ? 'text-gray-800' : 'text-gray-400'">{{ s.label }}</span>
            </button>
            <div v-if="i < steps.length - 1" class="h-px flex-1 min-w-4 bg-gray-200" />
          </template>
        </div>

        <!-- STEP 1 — The term -->
        <div v-if="current === 1" class="card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-[40px]">
            <span class="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style="background:#1E2157">1</span>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">The {{ termS }}</h2>
              <p class="text-sm text-gray-500">Pick the dates for the new {{ termS }}. We've filled in a suggestion — change anything you like.</p>
            </div>
          </div>
          <div v-if="futureTerms.length" class="flex flex-wrap gap-2">
            <button v-for="t in futureTerms" :key="t.id" type="button"
              class="px-3 py-1.5 rounded-lg border text-sm transition-colors"
              :class="termChoice === t.id ? 'border-[#1E2157] bg-[#1E2157] text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'"
              @click="termChoice = t.id">Use {{ t.name }}</button>
            <button type="button" class="px-3 py-1.5 rounded-lg border text-sm transition-colors"
              :class="termChoice === 'new' ? 'border-[#1E2157] bg-[#1E2157] text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'"
              @click="termChoice = 'new'">+ Create a new term</button>
          </div>
          <div class="space-y-3 max-w-3xl">
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
              <label class="w-full sm:w-32 shrink-0 text-sm font-medium text-gray-700">Name</label>
              <InputText v-model="termName" :placeholder="pickedTerm?.name || 'Term 4 2026'" class="flex-1 w-full" />
            </div>
            <div v-if="termChoice === 'new' || !pickedTermLocked" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
              <label class="w-full sm:w-32 shrink-0 text-sm font-medium text-gray-700">{{ cap(termS) }} dates</label>
              <div class="flex-1 w-full flex items-center gap-2">
                <DatePicker v-model="termStart" dateFormat="D d MM yy" showIcon class="flex-1 min-w-0" placeholder="Starts" />
                <span class="text-gray-300 shrink-0">–</span>
                <DatePicker v-model="termEnd" :minDate="termStart ?? undefined" dateFormat="D d MM yy" showIcon class="flex-1 min-w-0" placeholder="Ends">
                  <template #date="{ date }">
                    <span class="w-full h-full inline-flex items-center justify-center" @mouseenter="hoverDay = date">{{ date.day }}</span>
                  </template>
                  <template #footer>
                    <div class="px-2 py-2 text-xs border-t border-gray-100" :class="hoverHint(termStart) ? 'text-gray-700' : 'text-gray-400'">
                      {{ hoverHint(termStart) || 'Hover a date to see the term length' }}
                    </div>
                  </template>
                </DatePicker>
                <span class="text-xs text-gray-400 whitespace-nowrap w-14 shrink-0 text-right">{{ termWeeks }}</span>
              </div>
            </div>
            <template v-else>
              <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
                <span class="w-full sm:w-32 shrink-0 text-sm font-medium text-gray-700">{{ cap(termS) }} dates</span>
                <div class="flex-1 w-full flex items-center gap-2">
                  <span class="flex-1 min-w-0 text-sm text-gray-800 px-3 py-2 rounded-md bg-gray-50 border border-gray-100"><i class="pi pi-lock text-[10px] text-gray-300 mr-1.5" />{{ pickedTerm?.start_date ? fmtIso(pickedTerm.start_date) : '—' }}</span>
                  <span class="text-gray-300 shrink-0">–</span>
                  <span class="flex-1 min-w-0 text-sm text-gray-800 px-3 py-2 rounded-md bg-gray-50 border border-gray-100"><i class="pi pi-lock text-[10px] text-gray-300 mr-1.5" />{{ pickedTerm?.end_date ? fmtIso(pickedTerm.end_date) : '—' }}</span>
                  <span class="text-xs text-gray-400 whitespace-nowrap w-14 shrink-0 text-right">{{ termWeeks }}</span>
                </div>
              </div>
              <p class="text-xs text-amber-700 sm:pl-[152px]">Dates are locked — {{ pickedTermRegCount }} {{ pickedTermRegCount === 1 ? 'person is' : 'people are' }} already registered in this term.</p>
            </template>
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
              <label class="w-full sm:w-32 shrink-0 text-sm font-medium text-gray-700">Sign-ups</label>
              <div class="flex-1 w-full flex items-center gap-2">
                <DatePicker v-model="signupOpen" dateFormat="D d MM yy" showIcon class="flex-1 min-w-0" placeholder="Sign-up date" />
                <span class="text-gray-300 shrink-0">–</span>
                <DatePicker v-model="signupClose" :minDate="signupOpen ?? undefined" dateFormat="D d MM yy" showIcon class="flex-1 min-w-0" :placeholder="`${cap(termS)} end`">
                  <template #date="{ date }">
                    <span class="w-full h-full inline-flex items-center justify-center" @mouseenter="hoverDay = date">{{ date.day }}</span>
                  </template>
                  <template #footer>
                    <div class="px-2 py-2 text-xs border-t border-gray-100" :class="hoverHint(signupOpen ?? effTermStart) ? 'text-gray-700' : 'text-gray-400'">
                      {{ hoverHint(signupOpen ?? effTermStart, 'sign-ups') || 'Hover a date to see the sign-up window' }}
                    </div>
                  </template>
                </DatePicker>
                <span class="text-xs text-gray-400 whitespace-nowrap w-14 shrink-0 text-right">{{ signupWeeks }}</span>
              </div>
            </div>
            <p class="text-xs text-gray-400 sm:pl-[152px]">Sign-ups {{ signupOpen ? `open ${fmtDate(signupOpen)}` : 'open as soon as this is set up' }} · close {{ signupClose ? fmtDate(signupClose) : `when the ${termS} ends` }}.</p>
          </div>

          <!-- Timeline — a live visual of the sign-up window + term dates -->
          <div v-if="timeline" class="pt-2 space-y-1.5">
            <div class="flex items-center gap-3">
              <span class="w-16 shrink-0 text-[11px] font-semibold text-gray-400 text-right">Sign-ups</span>
              <div class="relative flex-1 h-8">
                <div class="absolute inset-y-0 left-0 right-0 rounded-lg bg-gray-100" />
                <div class="absolute inset-y-0 rounded-lg bg-emerald-400/80 flex items-center overflow-hidden"
                  :style="{ left: timeline.signup.left + '%', width: timeline.signup.width + '%' }">
                  <span class="relative text-[11px] font-semibold text-white px-2.5 truncate">{{ timeline.signup.label }}</span>
                </div>
                <div v-if="timeline.today !== null" class="absolute -inset-y-1 w-px bg-red-400" :style="{ left: timeline.today + '%' }" />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-16 shrink-0 text-[11px] font-semibold text-gray-400 text-right">{{ cap(termS) }}</span>
              <div class="relative flex-1 h-8">
                <div class="absolute inset-y-0 left-0 right-0 rounded-lg bg-gray-100" />
                <div v-if="timeline.prev" class="absolute inset-y-0 rounded-lg bg-slate-300 flex items-center overflow-hidden"
                  :style="{ left: timeline.prev.left + '%', width: timeline.prev.width + '%' }">
                  <span v-for="(t, i) in timeline.prev.ticks" :key="`pt${i}`" class="absolute top-0 bottom-0 w-px bg-white/60" :style="{ left: t + '%' }" />
                  <span class="relative text-[11px] font-semibold text-slate-600 px-2.5 truncate">{{ timeline.prev.label }}</span>
                </div>
                <div class="absolute inset-y-0 rounded-lg flex items-center overflow-hidden" style="background:#1E2157"
                  :style="{ left: timeline.term.left + '%', width: timeline.term.width + '%' }">
                  <span v-for="(t, i) in timeline.term.ticks" :key="`tt${i}`" class="absolute top-0 bottom-0 w-px bg-white/30" :style="{ left: t + '%' }" />
                  <span class="relative text-[11px] font-semibold text-white px-2.5 truncate">{{ timeline.term.label }}</span>
                </div>
                <div v-if="timeline.today !== null" class="absolute -inset-y-1 w-px bg-red-400" :style="{ left: timeline.today + '%' }" />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-16 shrink-0" />
              <div class="relative flex-1 h-4 text-[10px] text-gray-400">
                <span v-if="timeline.today === null || timeline.today > 9" class="absolute left-0">{{ timeline.axisStart }}</span>
                <span v-if="timeline.today !== null" class="absolute -translate-x-1/2 text-red-400 font-semibold whitespace-nowrap" :style="{ left: Math.min(96, Math.max(2, timeline.today)) + '%' }">Today</span>
                <span v-if="timeline.today === null || timeline.today < 91" class="absolute right-0">{{ timeline.axisEnd }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span v-if="runError" class="text-sm text-red-600">{{ runError }}</span>
            <span class="flex-1" />
            <Button :label="savingTerm ? 'Saving…' : 'Save & continue'" :loading="savingTerm" size="small" :disabled="!termValid" style="background:#1E2157;border-color:#1E2157" @click="saveTermStep" />
          </div>
        </div>

        <!-- STEP 2 — Programmes & their management team -->
        <div v-if="current === 2 && sourceGroupCount" class="card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-[40px]">
            <span class="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style="background:#1E2157">2</span>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">{{ cap(progP) }} &amp; management</h2>
              <p class="text-sm text-gray-500">Check who's in charge of each {{ progS }} before the new {{ termS }} starts. Remove anyone who's leaving, or search a name to fill an empty spot. You'll be able to create new roles once the {{ termS }} is set up.</p>
            </div>
          </div>
          <!-- One block per programme — fees-page feel: big gap + bold heading -->
          <div class="space-y-[60px]">
            <div v-for="pt in progTeams" :key="pt.key">
              <div class="flex items-center gap-2.5 mb-2 flex-wrap">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: pt.color || '#CBD5E1' }" />
                <span class="text-base font-semibold text-gray-900 truncate">{{ pt.name }}</span>
                <span class="text-xs text-gray-400">{{ pt.list.length }} {{ pt.list.length === 1 ? classS : classP }}</span>
                <span v-for="c in pt.coverage" :key="c.key"
                  class="text-[10px] px-1.5 py-0.5 rounded-full font-semibold num"
                  :class="c.have < c.min ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'">
                  {{ c.label }} {{ c.have }}/{{ c.min }}
                </span>
              </div>
              <div class="rounded-lg border border-gray-200 overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th class="px-4 py-2.5 font-semibold w-72">Person</th>
                      <th class="px-3 py-2.5 font-semibold">Role</th>
                      <th class="px-3 py-2.5 w-24" />
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr v-for="m in pt.team" :key="m.staffId" class="hover:bg-gray-50">
                      <td class="px-4 py-2">
                        <span class="flex items-center gap-2.5">
                          <span class="w-6 h-6 rounded-full text-white text-[9px] font-bold inline-flex items-center justify-center shrink-0" :style="{ background: avatarBg(m.id) }">{{ initials(m.name) }}</span>
                          <NuxtLink :to="`/people/${m.id}`" target="_blank" class="text-sm text-primary hover:underline truncate">{{ m.name }}</NuxtLink>
                        </span>
                      </td>
                      <td class="px-3 py-2">
                        <span class="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{{ m.role }}</span>
                        <span v-if="m.from" class="ml-1.5 text-[10px] text-gray-400" v-tooltip.top="`Assigned on ${m.from} — cascades down to ${pt.name}`">via {{ m.from }}</span>
                      </td>
                      <td class="px-3 py-2 text-right">
                        <button type="button" class="text-gray-300 hover:text-red-500" :title="`Remove ${m.name} as ${m.role} of ${m.from || pt.name}`" @click="removeCodeStaff(m, pt.name)">
                          <i class="pi pi-times-circle text-sm" />
                        </button>
                      </td>
                    </tr>
                    <!-- One empty row per unfilled role slot -->
                    <tr v-for="(slot, i) in pt.vacant" :key="`v-${slot.key}-${i}`">
                      <td class="px-4 py-1.5">
                        <span class="flex items-center gap-2.5">
                          <span class="w-6 h-6 rounded-full border-2 border-dashed border-gray-200 shrink-0" />
                          <AutoComplete :model-value="vacantPick[`${pt.key}:${slot.key}:${i}`]"
                            @update:model-value="(v: any) => vacantPick[`${pt.key}:${slot.key}:${i}`] = v"
                            :suggestions="personSuggestions" optionLabel="label" placeholder="Search a person…"
                            class="flex-1 min-w-0" @complete="searchPersonsFor"
                            :pt="{ pcInputText: { root: { class: '!py-1 !px-2 !text-sm !border-dashed !border-gray-300 !shadow-none w-64' } } }"
                            @item-select="(e: any) => assignVacant(pt, slot, e.value, `${pt.key}:${slot.key}:${i}`)" />
                        </span>
                      </td>
                      <td class="px-3 py-2">
                        <span class="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 font-medium">{{ slot.label }}</span>
                      </td>
                      <td class="px-3 py-2" />
                    </tr>
                    <tr v-if="!pt.team.length && !pt.vacant.length">
                      <td colspan="3" class="px-4 py-3 text-sm text-gray-400">No managers assigned<NuxtLink v-if="pt.key !== '__none'" :to="`/groups/codes/${pt.key}`" target="_blank" class="ml-1.5 text-xs text-primary hover:underline">Assign someone →</NuxtLink></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button type="button" class="text-sm text-gray-400 hover:text-gray-600" @click="goTo(1)">‹ Back</button>
            <span class="flex-1" />
            <Button label="Continue" size="small" style="background:#1E2157;border-color:#1E2157" @click="goTo(3)" />
          </div>
        </div>

        <!-- STEP 3 — Classes (only when there's something to roll) -->
        <div v-if="current === 3 && sourceGroupCount" class="card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-[40px]">
            <span class="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style="background:#1E2157">3</span>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Bring over your {{ classP }}?</h2>
              <p class="text-sm text-gray-500">Tick the {{ classP }} you're running again next {{ termS }}. For each one, choose whether the coaches and members come too.</p>
            </div>
          </div>
          <!-- One block per programme — fees-page feel: big gap + bold heading.
               The scroller sizes itself to the viewport (no second scrollbar). -->
          <div ref="classScroller" class="overflow-y-auto" :style="{ maxHeight: classListMaxH + 'px' }">
            <div class="space-y-[60px]">
              <div v-for="sec in classSections" :key="sec.key">
                <div class="flex items-center gap-2.5 mb-2">
                  <input type="checkbox" class="cursor-pointer" :checked="sec.list.every(g => included[g.id] || discontinued[g.id])" @change="toggleSection(sec, ($event.target as HTMLInputElement).checked)" />
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: sec.color || '#CBD5E1' }" />
                  <span class="text-base font-semibold text-gray-900 truncate">{{ sec.name }}</span>
                  <span class="text-xs text-gray-400">{{ sec.list.filter(g => included[g.id]).length }}/{{ sec.list.length }}</span>
                </div>
                <!-- overflow-visible so the staff hover popup isn't clipped;
                     the corner rounding lives on the header cells instead -->
                <div class="rounded-lg border border-gray-200">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th class="px-4 py-2.5 font-semibold bg-gray-50 rounded-tl-lg">Class</th>
                        <th class="px-3 py-2.5 font-semibold w-48 bg-gray-50">
                          <label class="flex items-center gap-1.5 cursor-pointer select-none"><input type="checkbox" class="shrink-0" :checked="sec.list.every(g => !included[g.id] || !g.staff.length || carryStaff[g.id])" @change="toggleSectionCarry(sec, carryStaff, ($event.target as HTMLInputElement).checked)" />Staff</label>
                        </th>
                        <th class="px-3 py-2.5 font-semibold w-56 bg-gray-50 rounded-tr-lg">
                          <label class="flex items-center gap-1.5 cursor-pointer select-none"><input type="checkbox" class="shrink-0" :checked="sec.list.every(g => !included[g.id] || !g.members.length || carryMembers[g.id])" @change="toggleSectionCarry(sec, carryMembers, ($event.target as HTMLInputElement).checked)" />Members</label>
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                    <tr v-for="g in sec.list" :key="g.id" class="hover:bg-gray-50" :class="included[g.id] ? '' : 'opacity-50'">
                      <td class="px-4 py-2">
                        <div class="flex items-center gap-2.5">
                          <input type="checkbox" v-model="included[g.id]" class="cursor-pointer" :disabled="discontinued[g.id]" />
                          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color || '#CBD5E1' }" />
                          <input v-model="renames[g.id]" type="text" :placeholder="g.name" :disabled="discontinued[g.id]"
                            class="flex-1 min-w-0 text-sm text-gray-800 bg-transparent border border-transparent hover:border-gray-200 focus:border-[#1E2157] focus:bg-white focus:ring-1 focus:ring-[#1E2157] rounded-md px-1.5 -mx-1.5 py-0.5 outline-none transition-colors"
                            :class="discontinued[g.id] ? 'line-through' : ''" />
                          <span v-if="discontinued[g.id]" class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 whitespace-nowrap shrink-0">discontinued</span>
                          <button v-if="discontinued[g.id]" type="button" class="text-xs font-medium text-primary hover:underline whitespace-nowrap shrink-0" @click="setDiscontinued(g, false)">Undo</button>
                          <button v-else-if="!included[g.id]" type="button" class="text-xs text-gray-400 hover:text-red-600 whitespace-nowrap shrink-0 transition-colors" title="This class is finishing for good — we won't ask about it again" @click="setDiscontinued(g, true)">Discontinue</button>
                        </div>
                      </td>
                      <td class="px-3 py-2 whitespace-nowrap relative">
                        <label class="flex items-center gap-1.5 cursor-pointer"
                          @mouseenter="g.staff.length && showPeople(`${g.id}:staff`)" @mouseleave="hidePeople()">
                          <input type="checkbox" class="shrink-0" v-model="carryStaff[g.id]" :disabled="!included[g.id] || !g.staff.length" />
                          <span class="text-xs text-gray-400 num">{{ staffPickedCount(g) < g.staff.length ? `${staffPickedCount(g)}/${g.staff.length}` : g.staff.length }}</span>
                        </label>
                        <div v-if="peopleHover === `${g.id}:staff`" @mouseenter="holdPeople()" @mouseleave="hidePeople()"
                          class="absolute z-30 top-full left-0 mt-1 w-60 card shadow-lg p-1.5 space-y-0.5">
                          <div v-for="p in g.staff.slice(0, 15)" :key="p.id" class="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-gray-50">
                            <input type="checkbox" class="shrink-0 cursor-pointer" v-model="staffPicks[g.id][p.id]" :title="staffPicks[g.id][p.id] ? `Don't carry ${p.name} over` : `Carry ${p.name} over`" />
                            <NuxtLink :to="`/people/${p.id}`" target="_blank"
                              class="flex-1 min-w-0 text-sm text-primary hover:underline truncate"
                              :class="staffPicks[g.id][p.id] === false ? 'line-through text-gray-400' : ''">{{ p.name }}</NuxtLink>
                          </div>
                          <p v-if="g.staff.length > 15" class="text-xs text-gray-400 px-1.5">+{{ g.staff.length - 15 }} more</p>
                        </div>
                      </td>
                      <td class="px-3 py-2 whitespace-nowrap">
                        <label class="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" class="shrink-0" v-model="carryMembers[g.id]" :disabled="!included[g.id] || !g.members.length" />
                          <span class="text-xs text-gray-400 num">{{ g.members.length }}</span>
                        </label>
                      </td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div class="pt-2 text-xs text-gray-500 flex items-center justify-between">
            <span><b class="font-semibold text-gray-700">{{ selectedCount }}</b> of {{ sourceGroupCount }} {{ classP }} selected · coaches carried on {{ staffCarryCount }}, members on {{ memberCarryCount }}<template v-if="discontinuedCount"> · {{ discontinuedCount }} discontinued</template></span>
            <NuxtLink to="/groups/rollover" class="text-primary hover:underline">Pick individual people →</NuxtLink>
          </div>
          <div class="flex items-center gap-3">
            <button type="button" class="text-sm text-gray-400 hover:text-gray-600" @click="goTo(2)">‹ Back</button>
            <span class="flex-1" />
            <Button label="Continue" size="small" style="background:#1E2157;border-color:#1E2157" @click="goTo(4)" />
          </div>
        </div>

        <!-- STEP 4 — Training sessions (only when classes are coming over) -->
        <div v-if="current === 4 && sourceGroupCount" class="card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-[40px]">
            <span class="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style="background:#1E2157">4</span>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Training sessions</h2>
              <p class="text-sm text-gray-500">Check each {{ classS }}'s weekly session times and change any that are different next {{ termS }} — they'll be added to the calendar as training sessions for {{ targetName }}.</p>
            </div>
          </div>
          <div v-if="genEvents" class="max-h-[55vh] overflow-y-auto">
            <div class="space-y-[60px]">
              <div v-for="sec in feeSections" :key="sec.key">
                <div class="flex items-center gap-2.5 mb-2">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: sec.color || '#CBD5E1' }" />
                  <span class="text-base font-semibold text-gray-900 truncate">{{ sec.name }}</span>
                  <span class="text-xs text-gray-400">{{ sec.list.length }} {{ sec.list.length === 1 ? classS : classP }}</span>
                </div>
                <div class="rounded-lg border border-gray-200 overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th class="px-4 py-2.5 font-semibold w-72">Class</th>
                        <th class="px-3 py-2.5 font-semibold">Weekly sessions</th>
                        <th class="px-3 py-2.5 font-semibold w-32 text-right">Events created</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                    <tr v-for="g in sec.list" :key="g.id" class="hover:bg-gray-50">
                      <td class="px-4 py-2 align-top">
                        <span class="flex items-center gap-2.5 pt-1">
                          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color || '#CBD5E1' }" />
                          <span class="text-sm text-gray-800 truncate">{{ renames[g.id]?.trim() || g.name }}</span>
                        </span>
                      </td>
                      <td class="px-3 py-1.5">
                        <div class="space-y-1.5">
                          <div v-for="s in (schedRows[g.id] || [])" :key="s.key" class="flex items-center gap-1.5">
                            <select v-model.number="s.day_of_week" @change="schedDirty[g.id] = true"
                              class="h-7 text-sm text-gray-800 bg-white border border-gray-200 rounded-md px-1 outline-none focus:border-[#1E2157]"
                              style="-webkit-appearance:auto;appearance:auto;background-color:#fff">
                              <option v-for="(d, i) in DAY3" :key="i" :value="i">{{ d }}</option>
                            </select>
                            <input type="time" v-model="s.start_time" @input="schedDirty[g.id] = true"
                              class="h-7 text-sm text-gray-800 bg-white border border-gray-200 rounded-md px-1 outline-none focus:border-[#1E2157]" style="-webkit-appearance:auto;appearance:auto" />
                            <span class="text-gray-300">–</span>
                            <input type="time" v-model="s.end_time" @input="schedDirty[g.id] = true"
                              class="h-7 text-sm text-gray-800 bg-white border border-gray-200 rounded-md px-1 outline-none focus:border-[#1E2157]" style="-webkit-appearance:auto;appearance:auto" />
                            <button type="button" class="text-gray-300 hover:text-red-500" title="Remove this session" @click="removeSchedRow(g.id, s.key)"><i class="pi pi-times-circle text-sm" /></button>
                          </div>
                          <button type="button" class="text-xs font-medium text-primary hover:underline" @click="addSchedRow(g.id)">+ Session</button>
                        </div>
                      </td>
                      <td class="px-3 py-2 text-right text-sm text-gray-600 num align-top"><span class="inline-block pt-1">{{ eventCountFor(g.id) || '—' }}</span></td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div v-if="genEvents" class="pt-1 text-xs text-gray-500">
            <b class="font-semibold text-gray-700">{{ totalEventCount }}</b> training sessions will be added to the calendar for {{ classesWithScheds }} {{ classesWithScheds === 1 ? classS : classP }}<template v-if="classesWithoutScheds"> · {{ classesWithoutScheds }} class{{ classesWithoutScheds === 1 ? '' : 'es' }} have no session times yet</template>
          </div>
          <div class="flex items-center gap-3">
            <button type="button" class="text-sm text-gray-400 hover:text-gray-600" @click="goTo(3)">‹ Back</button>
            <span class="flex-1" />
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <ToggleSwitch v-model="genEvents" />
              <span class="text-sm text-gray-700">Create the {{ termS }}'s training sessions automatically</span>
            </label>
            <Button label="Continue" size="small" style="background:#1E2157;border-color:#1E2157" @click="goTo(stepFees)" />
          </div>
        </div>

        <!-- STEP 4 — Fees -->
        <div v-if="current === stepFees" class="card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-[40px]">
            <span class="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style="background:#1E2157">{{ sourceGroupCount ? 5 : 2 }}</span>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Fees</h2>
              <p class="text-sm text-gray-500">Check through each {{ progS }} and {{ classS }} — the fees are set as last {{ termS }}'s ({{ sourceTerm?.name || 'the previous term' }}). Change anything you need, then confirm each {{ progS }}. Leave the fees empty to make a {{ classS }} free.</p>
            </div>
          </div>
          <template v-if="includedClasses.length">
            <!-- Programme progress: one sub-step per code, confirm to advance -->
            <div class="flex items-center gap-2 flex-wrap">
              <button v-for="(sec, i) in feeSections" :key="sec.key" type="button"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors"
                :class="i === feeCodeIdx ? 'border-[#1E2157] bg-[#1E2157] text-white' : confirmedCodes[sec.key] ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'"
                @click="feeCodeIdx = i">
                <i v-if="confirmedCodes[sec.key] && i !== feeCodeIdx" class="pi pi-check text-[9px]" />
                <span v-else-if="sec.color" class="w-1.5 h-1.5 rounded-full" :style="{ background: i === feeCodeIdx ? '#fff' : sec.color }" />
                {{ sec.name }}
              </button>
              <span class="text-xs text-gray-400 ml-1">{{ feeCodeIdx + 1 }} of {{ feeSections.length }} {{ progP }}</span>
            </div>

            <!-- Current programme -->
            <template v-if="currentFeeSection">
              <!-- The current fees — always visible, always editable -->
              <div class="space-y-[60px]">
                <div v-for="g in currentFeeSection.list" :key="g.id">
                  <div class="flex items-center gap-2.5 mb-2">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color || '#CBD5E1' }" />
                    <span class="text-base font-semibold text-gray-900 truncate">{{ renames[g.id]?.trim() || g.name }}</span>
                    <span v-if="!(feeOptRows[g.id]?.length)" class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">free — no fee</span>
                    <button type="button" class="ml-auto text-xs font-medium text-sky-300 hover:text-sky-600 transition-colors whitespace-nowrap" @click="addFeeOption(g.id)">+ Fee option</button>
                  </div>
                  <WizardFeeRowsEditor :rows="feeRowsFor(g.id)" :currency="orgCurrency" hide-add :baseline="feeBaseline" @change="feeDirtyMap[g.id] = true" />
                </div>
              </div>
            </template>
            <p class="text-xs text-gray-500"><b class="font-semibold text-gray-700">{{ feesWithAmountCount }}</b> of {{ includedClasses.length }} {{ classP }} will have a fee<template v-if="dirtyFeeCount"> · {{ dirtyFeeCount }} changed from {{ sourceTerm?.name || 'the previous term' }}</template> · fees are copied from {{ sourceTerm?.name || 'last term' }}</p>
          </template>
          <p v-else class="text-sm text-gray-400">No {{ classP }} are coming over — you can add fees to each {{ classS }} later.</p>
          <div class="flex items-center gap-3">
            <button type="button" class="text-sm text-gray-400 hover:text-gray-600" @click="feeBack()">‹ Back</button>
            <span class="flex-1" />
            <span v-if="includedClasses.length && currentFeeSection && unconfirmedAfterCurrent > 0" class="text-xs text-gray-400">{{ unconfirmedAfterCurrent }} {{ unconfirmedAfterCurrent === 1 ? progS : progP }} still to confirm</span>
            <Button v-if="includedClasses.length && currentFeeSection"
              :label="unconfirmedAfterCurrent > 0 ? `Confirm ${currentFeeSection.name} fees ›` : `Confirm ${currentFeeSection.name} fees & continue`"
              size="small" style="background:#1E2157;border-color:#1E2157" @click="confirmFeeSection" />
            <Button v-else label="Continue" size="small" style="background:#1E2157;border-color:#1E2157" @click="goTo(stepFees + 1)" />
          </div>
        </div>

        <!-- STEP 4 — Registration & comms -->
        <div v-if="current === stepFees + 1" class="card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-[40px]">
            <span class="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style="background:#1E2157">{{ sourceGroupCount ? 6 : 3 }}</span>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Registration &amp; letting members know</h2>
              <p class="text-sm text-gray-500">Here's how sign-ups will work for the new {{ termS }}.</p>
            </div>
          </div>
          <ul class="text-sm text-gray-600 space-y-1.5">
            <li class="flex items-start gap-2"><i class="pi pi-check-circle text-emerald-500 text-sm mt-0.5" />Each class keeps its sign-up form — the link families already have keeps working.</li>
            <li class="flex items-start gap-2"><i class="pi pi-check-circle text-emerald-500 text-sm mt-0.5" />Sign-ups open {{ signupOpen ? `on ${fmtDate(signupOpen)}` : 'right away' }} for every class that has a fee.</li>
            <li class="flex items-start gap-2 text-gray-400"><i class="pi pi-envelope text-sm mt-0.5" />Announcement email to members — <span class="text-[11px] font-semibold uppercase tracking-wide bg-gray-100 rounded px-1.5 py-0.5">coming soon</span></li>
          </ul>
          <div class="flex items-center gap-3">
            <button type="button" class="text-sm text-gray-400 hover:text-gray-600" @click="goTo(stepFees)">‹ Back</button>
            <span class="flex-1" />
            <Button label="Continue" size="small" style="background:#1E2157;border-color:#1E2157" @click="goTo(stepFees + 2)" />
          </div>
        </div>

        <!-- SUMMARY -->
        <div v-if="current === stepFees + 2" class="card p-5 space-y-4">
          <div class="flex items-center gap-3 mb-[40px]">
            <span class="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shrink-0"><i class="pi pi-check text-[10px]" /></span>
            <h2 class="text-lg font-semibold text-gray-900">Ready to go — here's what will happen</h2>
          </div>
          <ul class="text-sm text-gray-700 space-y-1.5">
            <li class="flex items-start gap-2"><i class="pi pi-bookmark text-gray-300 text-sm mt-0.5" /><span><b class="font-semibold">{{ targetName }}</b><template v-if="termChoice === 'new'"> is created</template>, {{ targetStartLabel }} – {{ targetEndLabel }}</span></li>
            <li class="flex items-start gap-2"><i class="pi pi-calendar text-gray-300 text-sm mt-0.5" /><span>Sign-ups open <b class="font-semibold">{{ signupOpen ? fmtDate(signupOpen) : 'right away' }}</b>, close <b class="font-semibold">{{ signupClose ? fmtDate(signupClose) : `at ${termS} end` }}</b></span></li>
            <li v-if="rolling" class="flex items-start gap-2"><i class="pi pi-users text-gray-300 text-sm mt-0.5" /><span><b class="font-semibold">{{ selectedCount }}</b> of {{ sourceGroupCount }} {{ classP }} come over from {{ sourceTerm!.name }} — coaches on {{ staffCarryCount }}, members on {{ memberCarryCount }}</span></li>
            <li v-else-if="sourceGroupCount" class="flex items-start gap-2"><i class="pi pi-users text-gray-300 text-sm mt-0.5" /><span>No {{ classP }} coming over — the {{ termS }} starts empty</span></li>
            <li v-if="rolling && genEvents && totalEventCount" class="flex items-start gap-2"><i class="pi pi-calendar-plus text-gray-300 text-sm mt-0.5" /><span><b class="font-semibold">{{ totalEventCount }}</b> training sessions added to the calendar for {{ classesWithScheds }} {{ classesWithScheds === 1 ? classS : classP }}, ready for attendance</span></li>
            <li v-if="rolling" class="flex items-start gap-2"><i class="pi pi-wallet text-gray-300 text-sm mt-0.5" /><span>{{ feesWithAmountCount }} of {{ includedClasses.length }} {{ classP }} will have a fee<template v-if="dirtyFeeCount"> — {{ dirtyFeeCount }} changed from {{ sourceTerm?.name }}</template><template v-else> (carried over unchanged)</template></span></li>
          </ul>
          <div class="flex items-center gap-3 pt-1">
            <button type="button" class="text-sm text-gray-400 hover:text-gray-600" @click="goTo(stepFees + 1)">‹ Back</button>
            <span v-if="runError" class="text-sm text-red-600">{{ runError }}</span>
            <span class="flex-1" />
            <Button :label="creating ? 'Setting up…' : `Set up ${targetName}`" :loading="creating"
              style="background:#1E2157;border-color:#1E2157" @click="run" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OrgTerm } from '~/composables/useTermsMemberships'
import type { CarryMode, RolloverGroup } from '~/composables/useTermRollover'
import { codeLineage } from '~/composables/useGroupCodes'
import type { GroupCode } from '~/composables/useGroupCodes'
import type { CodeStaff } from '~/composables/useCodeRoles'

const financesApi = useFinancesApi()
const { orgId } = useOrg()
const tm = useTermsMemberships()
const rollover = useTermRollover()
const gf = useGroupFees()
const groupsApi = useGroupsApi()
const membershipsApi = useMembershipsApi()
const peopleApi = usePeopleApi()

// A camelCase OrgTerm (from the seam) → this page's snake_case OrgTerm.
function termCamelToSnake(t: any): OrgTerm {
  return {
    id: t.id, org_id: t.orgId, name: t.name,
    start_date: t.startDate ?? null, end_date: t.endDate ?? null,
    signup_open: t.signupOpen ?? null, signup_close: t.signupClose ?? null,
    set_id: t.setId ?? null, status: t.status, sort_order: t.sortOrder ?? 0,
  }
}
// ── Terminology (never hardcode "class"/"programme" — clubs rename these) ──
// 'group' = the class concept, 'code' = the programme concept.
const terminology = useTerminology()
const termMap = ref<Record<string, { singular?: string; plural?: string }>>({})
const classS = computed(() => terminology.term(termMap.value, 'group').toLowerCase())
const classP = computed(() => terminology.term(termMap.value, 'group', true).toLowerCase())
const progS = computed(() => terminology.term(termMap.value, 'code').toLowerCase())
const progP = computed(() => terminology.term(termMap.value, 'code', true).toLowerCase())
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const termS = computed(() => terminology.term(termMap.value, 'term').toLowerCase())
const termP = computed(() => terminology.term(termMap.value, 'term', true).toLowerCase())
useBreadcrumbs([{ label: () => cap(classP.value), to: '/groups' }, { label: () => `${cap(termS.value)} set-up` }])

const loading = ref(true)
const done = ref(false)
const creating = ref(false)
const runError = ref('')
const revealed = ref(1)

const terms = ref<OrgTerm[]>([])
const groupCountByTerm = ref<Record<string, number>>({})
const feesGroupCount = ref(0)
const orgCurrency = ref('NZD')

// ── Step 1: the term ──
const termChoice = ref<string>('new')          // 'new' or an existing future-term id
const termName = ref('')
const termStart = ref<Date | null>(null)
const termEnd = ref<Date | null>(null)
const termStatus = ref<'active' | 'archived'>('active')

// ── Sign-up window (blank open = right away; blank close = term end) ──
const signupOpen = ref<Date | null>(null)
const signupClose = ref<Date | null>(null)

// ── Step 3: carry classes ──
// Per-class carry flags — Staff / Members columns in the classes table —
// plus optional renames (the clone takes the edited name).
const carryStaff = reactive<Record<string, boolean>>({})
const carryMembers = reactive<Record<string, boolean>>({})
const renames = reactive<Record<string, string>>({})

// ── Step 4: fees (one sub-step per programme/code) ──
// The Fees step walks the codes ONE AT A TIME: each class in the current code
// sits in its own box with a full fee editor (options + line items with
// per-line Xero codes), and the primary action CONFIRMS that programme before
// moving to the next. Dirty classes write their rows onto their clone at run.
// Items use the standard FeeLineItem shape so <FeeLineItemsTable> edits them.
type WizFeeItem = { id: string; name: string; xero_code: string; amount: number | null; _deleted?: boolean }
type FeeRow = { key: number; name: string; items: WizFeeItem[]; initName?: string; initTotal?: number | null }
let feeRowKey = 1
const feeOptRows = reactive<Record<string, FeeRow[]>>({})   // by class id
const feeDirtyMap = reactive<Record<string, boolean>>({})   // by class id
// Per-line-item carried values (keyed by item id) — drives the pale-yellow
// changed highlight + hover "Was … / Reset" in <FeeLineItemsTable>.
const feeBaseline: Record<string, { name: string; xero_code: string; amount: number | null }> = {}
const includedClasses = computed(() => classList.value.filter(g => included[g.id]))
const feeSections = computed(() => classSections.value
  .map(s => ({ ...s, list: s.list.filter(g => included[g.id]) }))
  .filter(s => s.list.length))
const feesWithAmountCount = computed(() => includedClasses.value.filter(g => (feeOptRows[g.id]?.length ?? 0) > 0).length)
const dirtyFeeCount = computed(() => includedClasses.value.filter(g => feeDirtyMap[g.id]).length)
function feeRowsFor(gid: string) { return (feeOptRows[gid] ??= []) }
function addFeeOption(gid: string) {
  feeRowsFor(gid).push({ key: feeRowKey++, name: '', items: [] })  // FeeLineItemsTable seeds its first row
  feeDirtyMap[gid] = true
}
function effFeeRows(g: RolloverGroup) { return feeOptRows[g.id] ?? [] }

// Programme sub-steps: index into feeSections + per-code confirmation.
const feeCodeIdx = ref(0)
const confirmedCodes = reactive<Record<string, boolean>>({})
const currentFeeSection = computed(() => feeSections.value[Math.min(feeCodeIdx.value, feeSections.value.length - 1)] ?? null)
// Every programme must be confirmed before the step can advance — confirming
// one moves to the next UNCONFIRMED programme (wherever it is), and only when
// none remain does the wizard continue to Registration.
const unconfirmedAfterCurrent = computed(() =>
  feeSections.value.filter(s => s.key !== currentFeeSection.value?.key && !confirmedCodes[s.key]).length)
function confirmFeeSection() {
  const sec = currentFeeSection.value
  if (sec) confirmedCodes[sec.key] = true
  const nextUnconfirmed = feeSections.value.findIndex(s => !confirmedCodes[s.key])
  if (nextUnconfirmed >= 0) {
    feeCodeIdx.value = nextUnconfirmed
    nextTick(() => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }))
  } else {
    goTo(stepFees.value + 1)
  }
}
function feeBack() {
  if (feeCodeIdx.value > 0) feeCodeIdx.value--
  else goTo(sourceGroupCount.value ? 4 : 1)
}

const result = reactive({ created: 0, feesAdded: 0, events: 0 })

// ── Step 2: programmes (codes) + their management team ──
// Assignments come from code_staff (lineage-keyed, /groups/codes/:id) so they
// survive the rollover untouched — this step is a review with Manage links.
const cr = useCodeRoles()
const codeStaffAll = ref<CodeStaff[]>([])
const codeRoleDefsW = ref<any[]>([])
const codesList = ref<GroupCode[]>([])
const AVATAR_BG = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#059669', '#0891B2', '#4F46E5', '#B45309']
function avatarBg(id: string) { let h = 0; for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return AVATAR_BG[h % AVATAR_BG.length] }
function initials(name: string) { return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?' }
const progTeams = computed(() => classSections.value.map(sec => {
  const code = sec.key === '__none' ? null : codesById.value[sec.key]
  const staff = code ? cr.staffForCode(code, codesById.value, codeStaffAll.value, codesList.value) : []
  const defs = code ? cr.rolesForCode(code, codesById.value, codeRoleDefsW.value) : []
  const roleLabel = (k: string) => defs.find((r: any) => r.key === k)?.label ?? k
  const team = staff.map(s => ({
    staffId: s.id,
    id: s.person_id,
    name: `${s.person?.first_name ?? ''} ${s.person?.last_name ?? ''}`.trim() || '—',
    roleKey: s.role_key,
    role: roleLabel(s.role_key),
    from: s.scope === 'inherited' ? s.fromLabel : '',
  }))
  // Which roles still need filling: role minimums resolved up the code chain
  // (closest wins — same coverage numbers as the Organise codes screen).
  const mins = code ? gc.effectiveRoleMins({ code_id: code.id }, codesById.value) : {}
  const coverage = Object.entries(mins).map(([key, min]) => ({
    key, min: min as number, label: roleLabel(key),
    have: team.filter(t => t.roleKey === key).length,
  }))
  // One empty (vacant) row per unfilled role slot — e.g. Coach 0/3 → 3 rows.
  const vacant = coverage.flatMap(c => Array.from({ length: Math.max(0, c.min - c.have) }, () => ({ key: c.key, label: c.label })))
  return { ...sec, team, coverage, vacant }
}))
async function removeCodeStaff(m: { staffId: string; name: string; role: string; from?: string }, progName: string) {
  const msg = m.from
    ? `${m.name} is assigned ${m.role} on ${m.from}, which covers ${progName} and its sibling ${progP.value}. Remove them from ${m.from}?`
    : `Remove ${m.name} as ${m.role} of ${progName}?`
  if (!window.confirm(msg)) return
  await cr.removeStaff(m.staffId)
  codeStaffAll.value = codeStaffAll.value.filter(s => s.id !== m.staffId)
}

// Vacant-slot person search: picking someone assigns them to that role on the
// programme's lineage right away (same write as /groups/codes/:id).
const vacantPick = reactive<Record<string, any>>({})
const personSuggestions = ref<{ id: string; label: string }[]>([])
async function searchPersonsFor(e: { query: string }) {
  const q = (e.query ?? '').trim()
  if (!q) { personSuggestions.value = []; return }
  const data = await peopleApi.list(orgId.value, { q, limit: 10 })
  personSuggestions.value = (data ?? []).map((p: any) => ({
    id: p.id, label: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.email || '—',
  }))
}
async function assignVacant(pt: { key: string }, slot: { key: string }, person: { id: string }, rowKey: string) {
  const code = codesById.value[pt.key]
  if (!code || !person?.id) return
  await cr.assignStaff(codeLineage(code), person.id, slot.key)
  vacantPick[rowKey] = null
  codeStaffAll.value = await cr.loadStaff()
}

// ── Step 3: the detailed class list (grouped by code/programme) ──
const gc = useGroupCodes()
const classList = ref<RolloverGroup[]>([])
const included = reactive<Record<string, boolean>>({})
const codesById = ref<Record<string, GroupCode>>({})
const classSections = computed(() => {
  const byCode: Record<string, RolloverGroup[]> = {}
  for (const g of classList.value) (byCode[g.code_id ?? '__none'] ??= []).push(g)
  return Object.entries(byCode)
    .map(([key, list]) => ({
      key, list,
      name: key === '__none' ? 'Ungrouped' : (codesById.value[key]?.name ?? 'Ungrouped'),
      color: key === '__none' ? null : (codesById.value[key]?.color ?? null),
    }))
    .sort((a, b) => (a.key === '__none' ? 1 : 0) - (b.key === '__none' ? 1 : 0) || a.name.localeCompare(b.name))
})
// Accordion state per code section — shared by the Classes / Trainings / Fees
// tables so a collapsed programme stays collapsed across steps.
const openSections = reactive<Record<string, boolean>>({})
const selectedCount = computed(() => classList.value.filter(g => included[g.id]).length)
const discontinuedCount = computed(() => classList.value.filter(g => discontinued[g.id]).length)
const staffCarryCount = computed(() => classList.value.filter(g => included[g.id] && carryStaff[g.id] && g.staff.length).length)
const memberCarryCount = computed(() => classList.value.filter(g => included[g.id] && carryMembers[g.id] && g.members.length).length)
const allIncluded = computed(() => classList.value.length > 0 && classList.value.every(g => included[g.id]))
const allStaff = computed(() => classList.value.length > 0 && classList.value.every(g => carryStaff[g.id] || !g.staff.length))
const allMembers = computed(() => classList.value.length > 0 && classList.value.every(g => carryMembers[g.id] || !g.members.length))
function toggleSection(sec: { list: RolloverGroup[] }, on: boolean) {
  for (const g of sec.list) if (!discontinued[g.id]) included[g.id] = on
}
function toggleSectionCarry(sec: { list: RolloverGroup[] }, map: Record<string, boolean>, on: boolean) {
  for (const g of sec.list) if (included[g.id]) map[g.id] = on
}

// Per-person staff carry: unticking someone in the staff hover popup excludes
// just them (rollOverGroups switches to 'pick' mode for that class).
const staffPicks = reactive<Record<string, Record<string, boolean>>>({})
function staffPickedCount(g: RolloverGroup) {
  const picks = staffPicks[g.id] ?? {}
  return g.staff.filter(p => picks[p.id] !== false).length
}

// A class the club has ENDED for good (migration 231) — excluded from this and
// every future rollover, and from the dashboard nudge. Persisted immediately
// on the SOURCE class; undoable.
const discontinued = reactive<Record<string, boolean>>({})
async function setDiscontinued(g: RolloverGroup, on: boolean) {
  discontinued[g.id] = on
  if (on) included[g.id] = false
  await groupsApi.update(g.id, { discontinuedAt: on ? new Date().toISOString() : null })
}
// ── Step 3: training sessions ──
// The term's weekly training events, generated from each class's session times.
const genEvents = ref(true)
const schedsByGroup = ref<Record<string, any[]>>({})
const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Editable session rows per class (seeded from the carried schedules; edits
// are written onto the NEW term's clone before events generate). Location is
// carried along invisibly so editing a time never loses the venue.
type SchedRow = { key: number; name: string | null; day_of_week: number; start_time: string; end_time: string; location: any }
let schedRowKey = 1
const schedRows = reactive<Record<string, SchedRow[]>>({})
const schedDirty = reactive<Record<string, boolean>>({})
function addSchedRow(gid: string) {
  (schedRows[gid] ??= []).push({ key: schedRowKey++, name: null, day_of_week: 1, start_time: '16:00', end_time: '17:00', location: null })
  schedDirty[gid] = true
}
function removeSchedRow(gid: string, key: number) {
  schedRows[gid] = (schedRows[gid] || []).filter(r => r.key !== key)
  schedDirty[gid] = true
}
// Weekly occurrences of a day-of-week inside the term window.
function occCount(dow: number) {
  const start = effTermStart.value, end = effTermEnd.value
  if (!start || !end) return 0
  const d = new Date(start)
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1)
  if (d > end) return 0
  return Math.floor((end.getTime() - d.getTime()) / 604800000) + 1
}
function eventCountFor(gid: string) {
  return (schedRows[gid] ?? []).reduce((n, s) => n + (s.start_time && s.end_time ? occCount(s.day_of_week) : 0), 0)
}
const totalEventCount = computed(() => includedClasses.value.reduce((n, g) => n + eventCountFor(g.id), 0))
const classesWithScheds = computed(() => includedClasses.value.filter(g => (schedRows[g.id]?.length ?? 0) > 0).length)
const classesWithoutScheds = computed(() => includedClasses.value.length - classesWithScheds.value)

// Hover POPOVER listing who's in the class — one linked name per line (a real
// overlay, not a tooltip, so the names can link to each person's profile).
// A short hide delay lets the cursor travel from the count into the popup.
const peopleHover = ref<string | null>(null)
let peopleHoverTimer: ReturnType<typeof setTimeout> | null = null
function showPeople(key: string) { if (peopleHoverTimer) clearTimeout(peopleHoverTimer); peopleHover.value = key }
function holdPeople() { if (peopleHoverTimer) clearTimeout(peopleHoverTimer) }
function hidePeople() { if (peopleHoverTimer) clearTimeout(peopleHoverTimer); peopleHoverTimer = setTimeout(() => { peopleHover.value = null }, 200) }
function toggleAll(map: Record<string, boolean>, on: boolean) {
  for (const g of classList.value) map[g.id] = on
}


// ── Derived ──
const today = new Date(); today.setHours(0, 0, 0, 0)
const sourceTerm = computed<OrgTerm | null>(() => {
  const withGroups = terms.value.filter(t => (groupCountByTerm.value[t.id] ?? 0) > 0 && t.start_date)
  if (!withGroups.length) return null
  return [...withGroups].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))[0]
})
const sourceGroupCount = computed(() => sourceTerm.value ? (groupCountByTerm.value[sourceTerm.value.id] ?? 0) : 0)
const sourceDaysLeft = computed(() => {
  const e = sourceTerm.value?.end_date
  return e ? Math.round((new Date(`${e}T00:00:00`).getTime() - today.getTime()) / 86400000) : null
})
// Only terms in the SAME term set as the source are rollover targets (232) —
// the Seniors' second half is never the juniors' Term 4.
const futureTerms = computed(() => terms.value.filter(t =>
  t.id !== sourceTerm.value?.id
  && (t.set_id ?? null) === (sourceTerm.value?.set_id ?? null)
  && t.start_date && new Date(`${t.start_date}T00:00:00`) > (sourceTerm.value?.end_date ? new Date(`${sourceTerm.value.end_date}T00:00:00`) : today)))
const pickedTerm = computed(() => terms.value.find(t => t.id === termChoice.value) ?? null)
const termValid = computed(() => termChoice.value !== 'new' || (!!termName.value.trim() && !!termStart.value && !!termEnd.value))
const targetName = computed(() => termChoice.value === 'new' ? (termName.value.trim() || 'the new term') : (pickedTerm.value?.name ?? ''))
const targetStartLabel = computed(() => termChoice.value === 'new' ? (termStart.value ? fmtDate(termStart.value) : '—') : (pickedTerm.value?.start_date ? fmtIso(pickedTerm.value.start_date) : '—'))
const targetEndLabel = computed(() => termChoice.value === 'new' ? (termEnd.value ? fmtDate(termEnd.value) : '—') : (pickedTerm.value?.end_date ? fmtIso(pickedTerm.value.end_date) : '—'))
const rolling = computed(() => sourceGroupCount.value > 0 && selectedCount.value > 0)
// Step numbering shifts when the classes step is hidden (no source groups).
// Term form (incl. sign-up window + status) = 1, classes = 2, fees = 3/2, …
const stepFees = computed(() => sourceGroupCount.value ? 5 : 2)

// The step indicator above the cards — `n` is each step's reveal index.
const steps = computed(() => {
  const s: { n: number; label: string }[] = [{ n: 1, label: `The ${termS.value}` }]
  if (sourceGroupCount.value) { s.push({ n: 2, label: cap(progP.value) }); s.push({ n: 3, label: cap(classP.value) }); s.push({ n: 4, label: 'Trainings' }) }
  s.push({ n: stepFees.value, label: 'Fees' })
  s.push({ n: stepFees.value + 1, label: 'Registration' })
  s.push({ n: stepFees.value + 2, label: 'Summary' })
  return s
})

// Picking an existing term seeds its saved name / dates / sign-up window into
// the form. Its DATES stay editable until someone has registered into the term
// (memberships on any of its groups) — then they lock.
const pickedTermLocked = ref(false)
const pickedTermRegCount = ref(0)
watch(termChoice, async () => {
  const t = pickedTerm.value
  if (!t) return
  termName.value = t.name ?? ''
  termStatus.value = (t.status as any) === 'archived' ? 'archived' : 'active'
  termStart.value = t.start_date ? new Date(`${t.start_date}T00:00:00`) : null
  termEnd.value = t.end_date ? new Date(`${t.end_date}T00:00:00`) : null
  signupOpen.value = t.signup_open ? new Date(`${t.signup_open}T00:00:00`) : null
  signupClose.value = t.signup_close ? new Date(`${t.signup_close}T00:00:00`) : null
  pickedTermLocked.value = false
  pickedTermRegCount.value = 0
  const ids = new Set((await groupsApi.list(orgId.value)).filter(g => g.termId === t.id).map(g => g.id))
  if (ids.size) {
    const mems = await groupsApi.membershipsByOrg(orgId.value)
    const count = mems.filter(m => ids.has(m.groupId)).length
    pickedTermRegCount.value = count
    pickedTermLocked.value = count > 0
  }
})

// Paged navigation: one step visible at a time; `revealed` = furthest visited
// (drives which stepper items are clickable).
const current = ref(1)
function goTo(n: number) {
  revealed.value = Math.max(revealed.value, n)
  current.value = n
  nextTick(() => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }))
}

// Size the class-list scroller to fill the viewport: from its top edge down to
// the bottom of the window, keeping room for the table footer + Continue row +
// page padding (~150px) so the page itself never grows a second scrollbar.
// (Must sit AFTER `current` is declared — watch() here would otherwise TDZ.)
const classScroller = ref<HTMLElement | null>(null)
const classListMaxH = ref(440)
function sizeClassList() {
  const el = classScroller.value
  if (!el) return
  classListMaxH.value = Math.max(220, window.innerHeight - el.getBoundingClientRect().top - 150)
}
watch(current, () => nextTick(sizeClassList))
onMounted(() => window.addEventListener('resize', sizeClassList))
onBeforeUnmount(() => window.removeEventListener('resize', sizeClassList))

// Calendar hover hint — hovering a day in an end-date picker shows how long
// the range would run from `from` to that day (rendered in the picker footer).
const hoverDay = ref<{ day: number; month: number; year: number } | null>(null)
function hoverHint(from: Date | null, what = 'term') {
  if (!hoverDay.value || !from) return ''
  const d = new Date(hoverDay.value.year, hoverDay.value.month, hoverDay.value.day)
  const w = wksLabel(from, d)
  if (!w) return ''
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} → ${w} of ${what}`
}

// "2 wks" between two dates, rounded to whole weeks (empty when not valid yet).
function wksLabel(a: Date | null, b: Date | null) {
  if (!a || !b || b.getTime() <= a.getTime()) return ''
  const w = Math.max(1, Math.round((b.getTime() - a.getTime()) / 604800000))
  return `${w} wk${w === 1 ? '' : 's'}`
}
// termStart/termEnd are seeded in both modes (create-new + picked-existing).
const effTermStart = computed(() => termStart.value)
const effTermEnd = computed(() => termEnd.value)
const termWeeks = computed(() => wksLabel(effTermStart.value, effTermEnd.value))
const signupWeeks = computed(() => {
  const start = effTermStart.value
  const open = signupOpen.value ?? (start && today.getTime() < start.getTime() ? new Date(today) : start)
  return wksLabel(open, signupClose.value ?? effTermEnd.value)
})

// Keep the ranges valid: an end date can never sit before its start.
watch(termStart, () => {
  if (termStart.value && termEnd.value && termEnd.value.getTime() < termStart.value.getTime()) termEnd.value = new Date(termStart.value)
})
watch(signupOpen, () => {
  if (signupOpen.value && signupClose.value && signupClose.value.getTime() < signupOpen.value.getTime()) signupClose.value = new Date(signupOpen.value)
})

// Timeline bar — a live picture of the sign-up window vs the term, with Today.
// Sign-ups run from signup_open (or today when blank) to signup_close (or term end).
const timeline = computed(() => {
  const start = termStart.value
  const end = termEnd.value
  if (!start || !end || end.getTime() <= start.getTime()) return null
  const openEff = signupOpen.value ?? (today.getTime() < start.getTime() ? new Date(today) : start)
  const closeEff = signupClose.value ?? end
  // Previous (source) term rides along on the Term lane for context.
  const prevStart = sourceTerm.value?.start_date ? new Date(`${sourceTerm.value.start_date}T00:00:00`) : null
  const prevEnd = sourceTerm.value?.end_date ? new Date(`${sourceTerm.value.end_date}T00:00:00`) : null
  const prevOk = !!(prevStart && prevEnd && sourceTerm.value?.id !== termChoice.value && prevEnd.getTime() > prevStart.getTime())
  const lo = Math.min(openEff.getTime(), start.getTime(), today.getTime(), prevOk ? prevStart!.getTime() : Infinity)
  const hi = Math.max(end.getTime(), closeEff.getTime())
  const pad = (hi - lo) * 0.03 || 86400000
  const min = lo - pad, max = hi + pad
  const pct = (t: number) => ((t - min) / (max - min)) * 100
  const short = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const seg = (a: Date, b: Date, name?: string) => {
    // Week tick positions, as % of the segment's own width.
    const days = (b.getTime() - a.getTime()) / 86400000
    const ticks: number[] = []
    for (let w = 7; w < days; w += 7) ticks.push((w / days) * 100)
    return {
      left: pct(a.getTime()),
      width: Math.max(1.5, pct(b.getTime()) - pct(a.getTime())),
      label: `${name ? name + ' · ' : ''}${short(a)} – ${short(b)}`,
      ticks,
    }
  }
  return {
    signup: seg(openEff, closeEff),
    term: seg(start, end, termChoice.value === 'new' ? termName.value.trim() || undefined : pickedTerm.value?.name),
    prev: prevOk ? seg(prevStart!, prevEnd!, sourceTerm.value!.name) : null,
    today: today.getTime() >= min && today.getTime() <= max ? pct(today.getTime()) : null,
    axisStart: short(new Date(min)),
    axisEnd: short(new Date(max)),
  }
})

// Suggest the next term from the source ("Term 3 2026" → "Term 4 2026", Term 4 wraps
// to Term 1 next year), starting the day after the source ends, same length.
function applySuggestion() {
  const src = sourceTerm.value
  if (src) {
    const n = src.name.match(/term\s*(\d+)/i)
    const y = src.name.match(/\b(20\d{2})\b/)
    let num = n ? Number(n[1]) : null
    let year = y ? Number(y[1]) : today.getFullYear()
    if (num != null) { if (num >= 4) { num = 1; year++ } else num++ }
    termName.value = num != null ? `Term ${num} ${year}` : `${src.name} — next`
    const srcStart = src.start_date ? new Date(`${src.start_date}T00:00:00`) : null
    const srcEnd = src.end_date ? new Date(`${src.end_date}T00:00:00`) : null
    const start = srcEnd ? new Date(srcEnd.getTime() + 86400000) : new Date(today)
    const len = srcStart && srcEnd ? Math.round((srcEnd.getTime() - srcStart.getTime()) / 86400000) : 70
    termStart.value = start
    termEnd.value = new Date(start.getTime() + len * 86400000)
  } else {
    const q = Math.min(4, Math.floor(today.getMonth() / 3) + 1)
    termName.value = `Term ${q} ${today.getFullYear()}`
    termStart.value = new Date(today)
    termEnd.value = new Date(today.getTime() + 70 * 86400000)
  }
}

// "Mon 16th July 2026" — day name + ordinal date + full month.
function ordinal(n: number) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}` }
function fmtDate(d: Date) {
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${ordinal(d.getDate())} ${d.toLocaleDateString(undefined, { month: 'long' })} ${d.getFullYear()}`
}
function fmtIso(iso: string) { return fmtDate(new Date(`${iso}T00:00:00`)) }
function fmtMoney(n: number) { return gf.fmtMoney(n, orgCurrency.value) }

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [loadedTerms, allGroups, currency, tmap] = await Promise.all([
    tm.loadTerms(),
    groupsApi.list(orgId.value),
    financesApi.orgCurrency(orgId.value).catch(() => null),
    terminology.resolveTerminology(orgId.value),
  ])
  terms.value = loadedTerms
  termMap.value = tmap
  if (currency) orgCurrency.value = currency
  // Only groups that belong to a term count towards the per-term totals.
  const groups = allGroups.filter(g => g.termId)
  const counts: Record<string, number> = {}
  for (const g of groups) counts[g.termId!] = (counts[g.termId!] || 0) + 1
  groupCountByTerm.value = counts

  // How many source classes already have fee options (for the fees step copy),
  // plus the full class list (grouped by code) for the detailed classes step.
  if (sourceTerm.value) {
    const srcIds: string[] = groups.filter(g => g.termId === sourceTerm.value!.id).map(g => g.id)
    if (srcIds.length) {
      // Fee options (with items) + schedules per source class come from the seam
      // (per-group, in parallel). srcGroups/codes/staff use their own composables.
      const [feeOptionLists, srcGroups, codes, schedLists, staffAll, roleDefs] = await Promise.all([
        Promise.all(srcIds.map(id => gf.loadFeeOptions(id))),
        rollover.loadTermGroups(sourceTerm.value.id),
        gc.loadCodes(),
        Promise.all(srcIds.map(id => groupsApi.schedules(id))),
        cr.loadStaff(),
        cr.ensureDefaults(),
      ])
      codeStaffAll.value = staffAll
      codeRoleDefsW.value = roleDefs
      codesList.value = (codes ?? []) as GroupCode[]
      // Schedules keyed by group id, mapped to the snake shape the step reads.
      const sb: Record<string, any[]> = {}
      srcIds.forEach((id, i) => {
        sb[id] = (schedLists[i] || []).map((s: any) => ({
          group_id: s.groupId, name: s.name, day_of_week: s.dayOfWeek,
          start_time: s.startTime, end_time: s.endTime, location: s.location,
        }))
      })
      schedsByGroup.value = sb
      for (const g of srcGroups) {
        schedRows[g.id] = (sb[g.id] ?? []).map((s: any) => ({
          key: schedRowKey++, name: s.name ?? null, day_of_week: s.day_of_week,
          start_time: String(s.start_time || '').slice(0, 5), end_time: String(s.end_time || '').slice(0, 5),
          location: s.location ?? null,
        }))
        schedDirty[g.id] = false
      }
      // Fee seeds: EVERY fee option each class carries over (the history), with its
      // full LINE ITEMS — from the seam (each option arrives hydrated with items).
      const optsByGroup: Record<string, any[]> = {}
      const itemsByOpt: Record<string, any[]> = {}
      srcIds.forEach((id, i) => {
        const opts = feeOptionLists[i] || []
        optsByGroup[id] = opts
        for (const o of opts) itemsByOpt[o.id] = o.items || []
      })
      feesGroupCount.value = srcIds.filter(id => (optsByGroup[id]?.length ?? 0) > 0).length
      classList.value = srcGroups
      codesById.value = Object.fromEntries((codes ?? []).map((c: GroupCode) => [c.id, c]))
      for (const g of srcGroups) {
        discontinued[g.id] = !!g.discontinued_at
        included[g.id] = !g.discontinued_at
        // Staff carry by default; members start UNTICKED (families re-register).
        carryStaff[g.id] = g.staff.length > 0; carryMembers[g.id] = false; renames[g.id] = g.name
        staffPicks[g.id] = Object.fromEntries(g.staff.map(p => [p.id, true]))
        openSections[g.code_id ?? '__none'] = true
        feeOptRows[g.id] = (optsByGroup[g.id] ?? []).map((o: any) => {
          const items: WizFeeItem[] = (itemsByOpt[o.id] ?? []).map((it: any) => {
            const item = { id: `wf-${feeRowKey++}`, name: it.name ?? '', xero_code: it.account ?? '', amount: Number(it.amount ?? 0) }
            feeBaseline[item.id] = { ...item }
            return item
          })
          const row: FeeRow = {
            key: feeRowKey++, name: o.name ?? '',
            items: items.length ? items : [{ id: `wf-${feeRowKey++}`, name: '', xero_code: '', amount: 0 }],
          }
          // Remember the carried values so edits can show "was $X" subtly.
          row.initName = row.name
          row.initTotal = row.items.reduce((n, i) => n + (i.amount ?? 0), 0)
          return row
        })
        feeDirtyMap[g.id] = false
      }
    }
  }

  applySuggestion()
  if (futureTerms.value.length) termChoice.value = futureTerms.value[0].id
  loading.value = false
}

// Create or update the term row (with its sign-up window) and remember its id —
// step 1's "Save & continue" persists immediately; run() re-persists with the
// latest values so late edits still land.
const savedTermId = ref<string | null>(null)
const savingTerm = ref(false)
async function persistTerm(): Promise<OrgTerm> {
  const signup = {
    signup_open: signupOpen.value ? tm.toIso(signupOpen.value) : null,
    signup_close: signupClose.value ? tm.toIso(signupClose.value) : null,
  }
  if (termChoice.value !== 'new') {
    const patch: any = { ...signup, status: termStatus.value, name: termName.value.trim() || pickedTerm.value!.name }
    // Dates are editable only while nobody has registered into the term.
    if (!pickedTermLocked.value && termStart.value && termEnd.value) {
      patch.start_date = tm.toIso(termStart.value)
      patch.end_date = tm.toIso(termEnd.value)
    }
    await membershipsApi.updateTerm(termChoice.value, {
      signupOpen: patch.signup_open, signupClose: patch.signup_close,
      status: patch.status, name: patch.name,
      ...(patch.start_date ? { startDate: patch.start_date, endDate: patch.end_date } : {}),
    })
    savedTermId.value = termChoice.value
    return { ...pickedTerm.value!, ...patch }
  }
  const camel = {
    orgId: orgId.value,
    name: termName.value.trim(),
    startDate: tm.toIso(termStart.value!),
    endDate: tm.toIso(termEnd.value!),
    signupOpen: signup.signup_open,
    signupClose: signup.signup_close,
    // The new term continues the source term's sequence (term set, 232).
    setId: sourceTerm.value?.set_id ?? null,
    status: termStatus.value,
  }
  if (savedTermId.value) {
    return termCamelToSnake(await membershipsApi.updateTerm(savedTermId.value, camel))
  }
  const created = await membershipsApi.createTerm({ ...camel, sortOrder: terms.value.length })
  savedTermId.value = created.id
  return termCamelToSnake(created)
}
async function saveTermStep() {
  if (savingTerm.value) return
  savingTerm.value = true
  runError.value = ''
  try { await persistTerm(); goTo(2) }
  catch (e: any) { runError.value = e?.message ?? 'Could not save the term — try again.' }
  finally { savingTerm.value = false }
}

async function run() {
  if (creating.value) return
  creating.value = true
  runError.value = ''
  try {
    // 1) Persist the term (created at step 1; re-saved here with any late edits).
    const target = await persistTerm()

    // 2) Roll the SELECTED classes over, each with its own Staff/Members choice
    //    (idempotent per lineage — safe to re-run).
    if (rolling.value && sourceTerm.value) {
      const { created } = await rollover.rollOverGroups(target, classList.value.filter(g => included[g.id]).map(g => {
        const picks = staffPicks[g.id] ?? {}
        const pickedIds = g.staff.filter(p => picks[p.id] !== false).map(p => p.id)
        const partial = pickedIds.length < g.staff.length
        return {
          source: g, include: true, name: renames[g.id]?.trim() || g.name,
          staffMode: (carryStaff[g.id] ? (partial ? 'pick' : 'rollover') : 'wipe') as CarryMode,
          staffIds: pickedIds,
          memberMode: (carryMembers[g.id] ? 'rollover' : 'wipe') as CarryMode, memberIds: [],
        }
      }))
      result.created = created
    }

    // Map source class → its clone in the new term (used by session edits,
    // event generation and fee replacement below).
    const clones = (await groupsApi.list(orgId.value)).filter(g => g.termId === target.id)
    const cloneBySrc: Record<string, string> = {}
    for (const c of clones) if (c.rolledFromGroupId) cloneBySrc[c.rolledFromGroupId] = c.id

    if (rolling.value && sourceTerm.value) {
      // 2b) Session-time edits from the Trainings step land on the CLONE's
      //     schedules (delete-then-insert, locations carried through).
      const schedEdited = classList.value.filter(g => included[g.id] && schedDirty[g.id])
      for (const g of schedEdited) {
        const cloneId = cloneBySrc[g.id]
        if (!cloneId) continue
        // Replace the clone's schedules via the seam (delete-then-insert).
        const rows = (schedRows[g.id] || [])
          .filter(r => r.start_time && r.end_time)
          .map((r, i) => ({
            name: r.name, dayOfWeek: r.day_of_week,
            startTime: r.start_time, endTime: r.end_time,
            location: r.location, sortOrder: i,
          }))
        await groupsApi.saveSchedules(cloneId, orgId.value, rows)
      }

      // 2c) Turn each new class's session times into the term's training
      //     events (idempotent — schedules with a master event are skipped).
      if (genEvents.value && result.created) {
        const { events } = await rollover.generateTrainingEvents(target, (clones ?? []).map((g: any) => g.id))
        result.events = events
      }
    }

    // 3) Fees — classes whose rows were touched get their cloned fee options
    //    REPLACED by the rows (each row = one upfront fee, with its Xero code);
    //    untouched classes keep the carried options exactly as they were.
    const dirty = classList.value.filter(g => included[g.id] && feeDirtyMap[g.id])
    if (dirty.length) {
      for (const g of dirty) {
        const cloneId = cloneBySrc[g.id]
        if (!cloneId) continue
        const rows = effFeeRows(g).filter(r =>
          r.name.trim() || r.items.some(it => it.amount != null || it.name.trim()))
        await gf.saveFeeOptions(cloneId, rows.map((r, i) => {
          const name = r.name.trim() || 'Term fee'
          return {
            id: '', name, fee_type: 'upfront',
            period_unit: null, period_count: null, auto_renew: false,
            instalment_count: null, session_count: null, prorata: false,
            due_date: null, deposit_percent: null, description: null,
            sort_order: i, status: 'active',
            items: r.items
              .filter(it => !it._deleted && (it.amount != null || it.name.trim()))
              .map((it, j) => ({ id: '', name: it.name.trim() || name, amount: it.amount ?? 0, account: it.xero_code.trim() || null, sort_order: j } as any)),
          } as any
        }))
        result.feesAdded++
      }
    }

    done.value = true
  } catch (e: any) {
    runError.value = e?.message ?? 'Something went wrong — nothing was lost, try again.'
  } finally {
    creating.value = false
  }
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>
