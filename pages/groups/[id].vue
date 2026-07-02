<template>
  <div class="w-full p-3 sm:p-6">
    <div v-if="loading" class="text-sm text-gray-400 py-8 text-center">Loading…</div>
    <div v-else-if="!group" class="text-sm text-gray-400 py-8 text-center">Group not found.</div>
    <template v-else>
      <!-- Frozen-term (history) banner -->
      <div v-if="isHistory" class="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
        <i class="pi pi-history" />
        <span><strong>{{ groupTerm?.name }}</strong> has ended — this group is history and is read-only.</span>
        <NuxtLink to="/groups/rollover" class="ml-auto text-primary hover:underline whitespace-nowrap text-xs font-medium">Roll over →</NuxtLink>
      </div>

      <!-- Tabs -->
      <div class="mb-4 flex gap-1 border-b border-gray-200 overflow-x-auto overflow-y-hidden no-scrollbar">
        <button v-for="t in groupTabs" :key="t.key" type="button"
          class="px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors inline-flex items-center gap-1.5"
          :class="activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'"
          @click="activeTab = t.key"><i class="pi text-xs" :class="t.icon" />{{ t.label }}</button>
      </div>

      <!-- Title + Add person (Details tab) -->
      <div v-show="activeTab === 'details'" class="mb-4 flex items-center gap-3 flex-wrap">
        <img v-if="group.image_url" :src="group.image_url" class="w-9 h-9 rounded-lg object-cover shrink-0" :alt="group.name" />
        <span v-else class="w-3 h-3 rounded-full shrink-0" :style="{ background: group.color || '#94a3b8' }" />
        <h1 class="text-xl font-semibold text-surface-900">{{ group.name }}</h1>
        <span v-for="r in myRoleLabels" :key="r" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1976d2]/10 text-[#1976d2] font-semibold" title="Your role in this group">{{ r }}</span>
        <Button v-if="canManage" label="Add person" icon="pi pi-user-plus"
          class="ml-auto w-full sm:w-auto justify-center"
          style="background:#1E2157;border-color:#1E2157" @click="openAdd('member')" />
      </div>

      <div v-show="activeTab === 'details'" class="flex flex-col lg:flex-row gap-4 items-start">
        <!-- Left column: Info + Session Times -->
        <div class="w-full lg:w-5/12 shrink-0 space-y-4">
          <!-- INFO -->
          <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="bg-primary text-white text-xs font-bold tracking-widest py-3.5 px-5 flex items-center justify-between">
              <span class="normal-case tracking-normal text-sm">Info</span>
              <button v-if="canManage" type="button"
                class="text-white/90 hover:text-white inline-flex items-center gap-1 text-[11px] font-semibold"
                @click="openGroupEditor">
                <i class="pi pi-pencil text-[10px]" /> Edit
              </button>
            </div>
            <div class="p-5 text-sm">
              <!-- Labelled fields -->
              <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-baseline">
                <dt class="text-left font-semibold text-gray-700">Code:</dt>
                <dd class="text-gray-700">
                  <span v-if="groupCode" class="inline-flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: groupCode.color || '#64748b' }" />
                    {{ groupCode.name }}
                  </span>
                  <span v-else class="text-gray-400">Ungrouped</span>
                </dd>
                <template v-if="groupMemberTypeLabel">
                  <dt class="text-left font-semibold text-gray-700">Member type:</dt>
                  <dd class="text-gray-700">{{ groupMemberTypeLabel }}</dd>
                </template>
                <dt class="text-left font-semibold text-gray-700">Head:</dt>
                <dd class="text-gray-700">{{ headCoach || '—' }}</dd>
                <dt class="text-left font-semibold text-gray-700">Age Range:</dt>
                <dd class="text-gray-700">{{ group.age_range || '—' }}</dd>
                <dt class="text-left font-semibold text-gray-700">Gender:</dt>
                <dd class="text-gray-700">{{ genderRestrictionLabel(group.gender_restriction) || 'Open to all' }}</dd>
                <dt class="text-left font-semibold text-gray-700">Members:</dt>
                <dd class="text-gray-700">{{ members.length }}<span v-if="group.capacity">/{{ group.capacity }}</span></dd>
                <dt class="text-left font-semibold text-gray-700">Waitlist:</dt>
                <dd class="text-gray-700">
                  <NuxtLink v-if="groupWaitlist" to="/groups/waitlists" class="text-[#1976d2] hover:underline inline-flex items-center gap-1">
                    <i class="pi pi-hourglass text-[10px]" />{{ groupWaitlist.name }}
                    <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ groupWaitlist.count }} waiting</span>
                  </NuxtLink>
                  <span v-else class="text-gray-400">None</span>
                </dd>
                <dt class="text-left font-semibold text-gray-700">Current Term:</dt>
                <dd class="text-gray-700">
                  {{ groupTerm?.name || group.current_term || '—' }}
                  <span v-if="isHistory" class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">ended</span>
                </dd>
                <dt class="text-left font-semibold text-gray-700">Fees:</dt>
                <dd class="text-gray-700 flex items-center gap-2 flex-wrap">
                  <template v-if="feeOptions.length">
                    <span>{{ termFeeLabel }}</span>
                    <button v-if="canManage" type="button" @click="openFeesEditor"
                      class="text-[11px] font-semibold text-[#1976d2] hover:underline inline-flex items-center gap-1">
                      <i class="pi pi-pencil text-[9px]" />{{ feeBtnLabel }}
                    </button>
                  </template>
                  <button v-else-if="canManage" type="button" @click="openFeesEditor"
                    class="inline-flex items-center gap-1 text-xs font-semibold text-white rounded px-2.5 py-1"
                    style="background:#1976d2">
                    <i class="pi pi-plus text-[9px]" /> Add a fee
                  </button>
                </dd>
              </dl>

              <!-- Signup readiness — flag anything blocking members from signing up -->
              <div v-if="!signupReady" class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-1.5 text-amber-800 text-xs">
                <i class="pi pi-exclamation-triangle text-[11px] shrink-0" />
                <span class="font-semibold shrink-0">Not ready for signup —</span>
                <span class="text-amber-700 truncate" :title="signupIssues.join(' · ')">{{ signupIssues.join(' · ') }}</span>
              </div>
              <div v-else class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-1.5 font-semibold text-emerald-800 text-xs">
                <i class="pi pi-check-circle text-[11px]" /> Ready for signup
              </div>
            </div>
          </div>

          <!-- FEES (multiple ways to pay to join — migration 204).
               Only shown when there's MORE than one option; a single fee (or none)
               lives inline on the INFO card's Fees row with an add/edit button. -->
          <div v-if="feeOptions.length > 1" class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="bg-primary text-white text-xs font-bold tracking-widest py-3.5 px-5 flex items-center justify-between">
              <span class="normal-case tracking-normal text-sm">Fees</span>
              <button v-if="canManage" type="button"
                class="text-white/90 hover:text-white inline-flex items-center gap-1 text-[11px] font-semibold"
                @click="openFeesEditor">
                <i class="pi pi-pencil text-[10px]" /> Edit
              </button>
            </div>
            <div class="p-5 text-sm space-y-3">
              <p class="text-xs text-gray-500">How a member can choose to pay to join this group.</p>
              <div v-if="!feeOptions.length" class="text-gray-400">No fee options yet.</div>
              <div v-for="o in feeOptions" :key="o.id" class="border border-gray-200 rounded-lg p-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-gray-800">{{ o.name }}</span>
                  <span class="font-semibold text-gray-900 tabular-nums whitespace-nowrap">{{ gf.priceLabel(o, orgCurrency) }}</span>
                </div>
                <div class="text-[11px] text-gray-400 mt-0.5">{{ gf.feeTypeLabel(o.fee_type) }}</div>
                <div v-if="o.items.length" class="mt-2 space-y-0.5 border-t border-gray-100 pt-2">
                  <div v-for="it in o.items" :key="it.id" class="flex items-center justify-between text-xs text-gray-600">
                    <span>{{ it.name || '—' }}</span>
                    <span class="tabular-nums">{{ gf.fmtMoney(it.amount, orgCurrency) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- SESSION TIMES (own card, below INFO) -->
          <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="bg-primary text-white text-xs font-bold tracking-widest py-3.5 px-5 flex items-center justify-between">
              <span class="normal-case tracking-normal text-sm">Session times</span>
              <button v-if="canManage" type="button"
                class="text-white/90 hover:text-white inline-flex items-center gap-1 text-[11px] font-semibold"
                @click="openScheduleEditor">
                <i class="pi pi-pencil text-[10px]" /> Edit
              </button>
            </div>
            <div class="p-4 space-y-3">
              <div v-if="!schedules.length" class="text-sm text-gray-400">—</div>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs font-bold text-gray-700 border-b border-gray-200">
                      <th class="py-2 pr-3">Name</th>
                      <th class="py-2 pr-3">Day</th>
                      <th class="py-2 pr-3">Time</th>
                      <th class="py-2 pr-3">Location</th>
                      <th class="py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in schedules" :key="s.id" class="border-b border-gray-100">
                      <td class="py-2 pr-3 font-medium text-gray-800">{{ s.name || '—' }}</td>
                      <td class="py-2 pr-3 text-gray-700">{{ dayNames[s.day_of_week] }}</td>
                      <td class="py-2 pr-3 text-gray-700 whitespace-nowrap">{{ formatTime(s.start_time) }} – {{ formatTime(s.end_time) }}</td>
                      <td class="py-2 pr-3 text-gray-500">{{ locationLabel(s.location) || '—' }}</td>
                      <td class="py-2 text-right">
                        <NuxtLink v-if="trainingEventByScheduleId[s.id]"
                          :to="`/events/${trainingEventByScheduleId[s.id].id}`"
                          class="text-[11px] font-semibold text-[#1976d2] hover:underline inline-flex items-center gap-0.5"
                          :title="`Open ${trainingEventByScheduleId[s.id].title}`">
                          Open <i class="pi pi-arrow-right text-[9px]" />
                        </NuxtLink>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- Create / link training events -->
              <div v-if="canManage && missingTrainingEvents.length" class="pt-1">
                <button type="button"
                  class="w-full text-xs font-semibold text-white px-3 py-2 rounded inline-flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  :class="!createBlockedReason ? 'bg-[#1976d2] hover:bg-[#125ea8]' : 'bg-gray-400'"
                  :disabled="creatingEvent || !!createBlockedReason"
                  @click="createAttendanceEvent">
                  <i class="pi pi-plus text-[10px]" />
                  {{ creatingEvent ? 'Creating…' : createButtonLabel }}
                </button>
                <p v-if="createBlockedReason" class="text-[11px] text-gray-400 mt-1 text-center">{{ createBlockedReason }}</p>
              </div>

            </div>
          </div>

          <!-- UPCOMING EVENTS (own module) — the training events linked to this group -->
          <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="bg-primary text-white text-xs font-bold tracking-widest py-3.5 px-5 flex items-center justify-between">
              <span class="normal-case tracking-normal text-sm">Upcoming events</span>
              <button v-if="upcomingEvents.length > 5" type="button"
                class="text-white/90 hover:text-white inline-flex items-center gap-1 text-[11px] font-semibold"
                @click="showAllUpcoming = !showAllUpcoming">
                {{ showAllUpcoming ? 'Show next 5' : 'See all upcoming' }}
                <i class="pi text-[9px]" :class="showAllUpcoming ? 'pi-chevron-up' : 'pi-arrow-right'" />
              </button>
            </div>
            <div class="p-4">
              <div v-if="!upcomingEvents.length" class="text-sm text-gray-400">No upcoming events.</div>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs font-bold text-gray-700 border-b border-gray-200">
                      <th class="py-2 pr-3">Name</th>
                      <th class="py-2 pr-3 whitespace-nowrap">Start</th>
                      <th class="py-2 pr-3 whitespace-nowrap">End</th>
                      <th class="py-2 pr-3">Location</th>
                      <th class="py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="e in visibleUpcoming" :key="e.id"
                      class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      @click="navigateTo(`/events/${e.id}`)">
                      <td class="py-2 pr-3 font-medium text-gray-800">{{ e.title }}</td>
                      <td class="py-2 pr-3 text-gray-600 whitespace-nowrap">{{ fmtEventWhen(e.start_at) }}</td>
                      <td class="py-2 pr-3 text-gray-600 whitespace-nowrap">{{ fmtEndCell(e) }}</td>
                      <td class="py-2 pr-3 text-gray-500">{{ (e.location && locationLabel(e.location)) || '—' }}</td>
                      <td class="py-2 text-right"><i class="pi pi-arrow-right text-[9px] text-gray-300" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- People — coaches & members, two sections (Details tab) -->
        <div class="flex-1 min-w-0 w-full">
          <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
            <table class="w-full text-sm table-fixed">
              <colgroup>
                <col v-for="col in activeColumns" :key="col.key" :class="col.width" />
                <col v-if="canManage" class="w-24" />
              </colgroup>

              <!-- COACHES & MANAGERS -->
              <tbody>
                <tr>
                  <td :colspan="colCount" class="bg-primary text-white text-xs font-bold tracking-widest py-3.5 px-5">
                    <div class="flex items-center justify-between">
                      <span class="normal-case tracking-normal text-sm">Coaches &amp; Managers</span>
                      <div class="flex items-center gap-3">
                        <i class="pi pi-envelope text-white/90 text-sm" />
                        <i class="pi pi-mobile text-white/90 text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="staffRoleShortfalls.length">
                  <td :colspan="colCount" class="bg-amber-50 border-b border-amber-100 px-5 py-2 text-xs text-amber-800">
                    <i class="pi pi-exclamation-triangle text-[10px] mr-1" />
                    Needs
                    <span v-for="(s, i) in staffRoleShortfalls" :key="s.key">{{ i ? ', ' : ' ' }}<span class="font-semibold">{{ s.need - s.have }} more {{ s.label }}</span> ({{ s.have }}/{{ s.need }})</span>
                    <span class="text-amber-500"> — minimum set on this group's code.</span>
                  </td>
                </tr>
                <tr class="text-left text-xs font-bold text-gray-700 border-b border-gray-200">
                  <th v-for="col in activeColumns" :key="col.key" class="px-4 py-2.5 font-bold align-middle">
                    <span v-if="col.key === 'name'" class="flex items-center gap-2">
                      <span class="inline-flex items-center justify-center w-6 h-6 shrink-0">
                        <Checkbox :modelValue="coachSelMode" binary @update:modelValue="setCoachSelMode" title="Select coaches" />
                      </span>
                      <span>{{ col.label }}<span v-if="coachSelMode && coachSel.length" class="text-gray-400 font-normal ml-1">({{ coachSel.length }})</span></span>
                    </span>
                    <template v-else>{{ col.label }}</template>
                  </th>
                  <th v-if="canManage" class="px-4 py-2.5" />
                </tr>
                <tr v-for="c in displayCoaches" :key="c.id" class="border-b border-gray-100 hover:bg-gray-50">
                  <td v-for="col in activeColumns" :key="col.key" class="px-4 py-2.5 text-gray-700 align-top">
                    <template v-if="col.key === 'name'">
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center justify-center w-6 h-6 shrink-0">
                          <Checkbox v-if="coachSelMode" :modelValue="coachSel.includes(c.id)" binary
                            @update:modelValue="v => toggleRowSel('coach', c.id, v)" />
                          <button v-else type="button" title="Actions"
                            class="w-6 h-6 rounded-full border border-gray-300 text-gray-400 hover:text-[#1976d2] hover:border-[#1976d2] inline-flex items-center justify-center"
                            @click="openPersonMenu($event, c)">
                            <i class="pi pi-user text-[11px]" />
                          </button>
                        </span>
                        <button type="button" class="text-[#1976d2] hover:underline text-left" @click="openAdd('coach', c)">{{ c.name }}</button>
                      </div>
                    </template>
                    <template v-else-if="col.key === 'roles'">
                      <InlineChips :items="(c.roles ?? []).map(roleLabel)" variant="blue" />
                    </template>
                    <template v-else>{{ (c as any)[col.key] || '' }}</template>
                  </td>
                  <td v-if="canManage" class="px-4 py-2.5 text-right align-top">
                    <div class="inline-flex items-center gap-3">
                      <PersonNotes :person-id="c.id" :person-name="c.name" :links="noteLinks" :initial-count="noteCounts[c.id] ?? 0"
                        :context-label="noteContextLabel" :can-edit-all="canEditNotes" :can-delete-all="canDeleteNotes" @count-change="v => noteCounts[c.id] = v" />
                      <button type="button" class="text-red-500 hover:text-red-700"
                        :title="`Remove ${c.name} from ${group.name}`" @click="removeCoach(c)">
                        <i class="pi pi-times-circle text-base" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!displayCoaches.length && !codeStaffForGroup.length">
                  <td :colspan="colCount" class="p-6 text-center text-sm text-gray-400">
                    No coaches or managers assigned.
                    <button v-if="canManage" type="button" class="ml-1 text-[#1976d2] hover:underline font-medium" @click="openAdd('coach')">Add one</button>
                  </td>
                </tr>

                <!-- Staff assigned at CODE level (cascade to this group) — read-only, collapsible -->
                <template v-if="codeStaffForGroup.length">
                  <tr>
                    <td :colspan="colCount" class="bg-gray-100/70 border-y border-gray-200 p-0">
                      <button type="button" class="w-full flex items-center gap-1.5 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
                        @click="codeStaffOpen = !codeStaffOpen">
                        <i class="pi text-[10px] transition-transform" :class="codeStaffOpen ? 'pi-chevron-down' : 'pi-chevron-right'" />
                        <i class="pi pi-sitemap text-[10px]" /> Assigned at code level
                        <span class="text-gray-400 font-normal normal-case tracking-normal">({{ codeStaffForGroup.length }})</span>
                      </button>
                    </td>
                  </tr>
                  <tr v-for="s in codeStaffForGroup" v-show="codeStaffOpen" :key="`cs-${s.id}`" class="border-b border-gray-100 bg-gray-50/40">
                    <td v-for="col in activeColumns" :key="col.key" class="px-4 py-2.5 text-gray-700 align-top">
                      <template v-if="col.key === 'name'">
                        <div class="flex items-center gap-2">
                          <span class="inline-flex items-center justify-center w-6 h-6 shrink-0"><i class="pi pi-shield-o text-gray-300 text-[11px]" /></span>
                          <NuxtLink :to="`/people/${s.person_id}`" class="text-[#1976d2] hover:underline">{{ codeStaffName(s) }}</NuxtLink>
                        </div>
                      </template>
                      <template v-else-if="col.key === 'roles'">
                        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium"
                          v-tooltip.top="s.scope === 'inherited' ? `Assigned on code ${s.fromLabel}` : 'Assigned on this code'">{{ roleLabel(s.role_key) }}</span>
                      </template>
                      <template v-else-if="col.key === 'email'">{{ s.person?.email || '—' }}</template>
                      <template v-else>—</template>
                    </td>
                    <td v-if="canManage" class="px-4 py-2.5" />
                  </tr>
                </template>
              </tbody>

              <!-- MEMBERS -->
              <tbody>
                <tr>
                  <td :colspan="colCount" class="bg-primary text-white text-xs font-bold tracking-widest py-3.5 px-5 border-t-4 border-white">
                    <div class="flex items-center justify-between">
                      <span class="normal-case tracking-normal text-sm">Members</span>
                      <div class="flex items-center gap-3">
                        <i class="pi pi-envelope text-white/90 text-sm" />
                        <i class="pi pi-mobile text-white/90 text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="positionShortfalls.length">
                  <td :colspan="colCount" class="bg-amber-50 border-b border-amber-100 px-5 py-2 text-xs text-amber-800">
                    <i class="pi pi-exclamation-triangle text-[10px] mr-1" />
                    Needs
                    <span v-for="(s, i) in positionShortfalls" :key="s.name">{{ i ? ', ' : ' ' }}<span class="font-semibold">{{ s.need - s.have }} more {{ s.name }}</span> ({{ s.have }}/{{ s.need }})</span>
                    <span class="text-amber-500"> — minimum set on this group's code.</span>
                  </td>
                </tr>
                <tr class="text-left text-xs font-bold text-gray-700 border-b border-gray-200">
                  <th v-for="col in activeColumns" :key="col.key" class="px-4 py-2.5 font-bold align-middle">
                    <span v-if="col.key === 'name'" class="flex items-center gap-2">
                      <span class="inline-flex items-center justify-center w-6 h-6 shrink-0">
                        <Checkbox :modelValue="memberSelMode" binary @update:modelValue="setMemberSelMode" title="Select members" />
                      </span>
                      <span>{{ col.label }}<span v-if="memberSelMode && memberSel.length" class="text-gray-400 font-normal ml-1">({{ memberSel.length }})</span></span>
                    </span>
                    <template v-else>{{ col.key === 'roles' ? 'Positions' : col.label }}</template>
                  </th>
                  <th v-if="canManage" class="px-4 py-2.5" />
                </tr>
                <tr v-for="m in displayMembers" :key="m.id" class="border-b border-gray-100 hover:bg-gray-50">
                  <td v-for="col in activeColumns" :key="col.key" class="px-4 py-2.5 text-gray-700 align-top">
                    <template v-if="col.key === 'name'">
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center justify-center w-6 h-6 shrink-0">
                          <Checkbox v-if="memberSelMode" :modelValue="memberSel.includes(m.id)" binary
                            @update:modelValue="v => toggleRowSel('member', m.id, v)" />
                          <button v-else type="button" title="Actions"
                            class="w-6 h-6 rounded-full border border-gray-300 text-gray-400 hover:text-[#1976d2] hover:border-[#1976d2] inline-flex items-center justify-center"
                            @click="openPersonMenu($event, m)">
                            <i class="pi pi-user text-[11px]" />
                          </button>
                        </span>
                        <button type="button" class="text-[#1976d2] hover:underline text-left" @click="openAdd('member', m)">{{ m.name }}</button>
                      </div>
                    </template>
                    <template v-else-if="col.key === 'roles'">
                      <InlineChips :items="m.positions ?? []" variant="green" />
                    </template>
                    <template v-else>{{ (m as any)[col.key] || '' }}</template>
                  </td>
                  <td v-if="canManage" class="px-4 py-2.5 text-right align-top">
                    <div class="inline-flex items-center gap-3">
                      <PersonNotes :person-id="m.id" :person-name="m.name" :links="noteLinks" :initial-count="noteCounts[m.id] ?? 0"
                        :context-label="noteContextLabel" :can-edit-all="canEditNotes" :can-delete-all="canDeleteNotes" @count-change="v => noteCounts[m.id] = v" />
                      <button type="button" class="text-red-500 hover:text-red-700"
                        :title="`Remove ${m.name} from ${group.name}`" @click="removeMember(m)">
                        <i class="pi pi-times-circle text-base" />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!displayMembers.length">
                  <td :colspan="colCount" class="p-6 text-center text-sm text-gray-400">
                    No members in this group yet.
                    <button v-if="canManage" type="button" class="ml-1 text-[#1976d2] hover:underline font-medium" @click="openAdd('member')">Add one</button>
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>

      <!-- PEOPLE tab — single PrimeVue DataTable -->
      <div v-show="activeTab === 'people'" class="space-y-3">
        <!-- Toolbar (search left, actions right) -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <IconField iconPosition="left">
            <InputIcon class="pi pi-search" />
            <InputText v-model="peopleSearch" placeholder="Search here" class="w-48 sm:w-60" />
          </IconField>
          <div class="flex flex-wrap items-center gap-2">
            <Button outlined severity="secondary" icon="pi pi-filter" label="Filter"
              :badge="roleFilter.length ? String(roleFilter.length) : undefined"
              class="text-gray-700" @click="filterPanel.toggle($event)" />
            <Button outlined severity="secondary" icon="pi pi-table" label="Columns"
              class="text-gray-700" @click="colsPanel.toggle($event)" />
            <Button icon="pi pi-download" label="Export"
              style="background:#1E2157;border-color:#1E2157" @click="exportPeopleVisible" />
          </div>
        </div>

        <!-- Filter popover (by role) -->
        <Popover ref="filterPanel">
          <div class="w-56 text-sm">
            <div class="text-xs font-semibold text-gray-400 mb-2">Filter by role</div>
            <div class="flex flex-col gap-1.5 max-h-64 overflow-auto">
              <label v-for="r in filterRoleOptions" :key="r.value" class="flex items-center gap-2 cursor-pointer">
                <Checkbox :modelValue="roleFilter.includes(r.value)" binary @update:modelValue="() => toggleRoleFilter(r.value)" />
                <span>{{ r.label }}</span>
              </label>
              <p v-if="!filterRoleOptions.length" class="text-gray-400">No roles defined.</p>
            </div>
            <button v-if="roleFilter.length" type="button" class="mt-3 text-xs font-semibold text-[#1976d2]" @click="roleFilter = []">Clear filters</button>
          </div>
        </Popover>

        <!-- Columns popover -->
        <Popover ref="colsPanel">
          <div class="w-52 text-sm">
            <div class="text-xs font-semibold text-gray-400 mb-2">Show columns</div>
            <div class="flex flex-col gap-1.5">
              <label v-for="col in personColumns" :key="col.key" class="flex items-center gap-2"
                :class="col.key === 'name' ? 'opacity-50' : 'cursor-pointer'">
                <Checkbox :modelValue="!hiddenCols.includes(col.key)" binary :disabled="col.key === 'name'"
                  @update:modelValue="() => toggleHiddenCol(col.key)" />
                <span>{{ col.label }}</span>
              </label>
            </div>
          </div>
        </Popover>

        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <DataTable ref="dt" :value="displayPeople" dataKey="id"
            v-model:selection="peopleSelection" v-model:sortField="sortField" v-model:sortOrder="sortOrder"
            :paginator="displayPeople.length > 25" :rows="25" :rowsPerPageOptions="[25, 50, 100]"
            removableSort class="text-sm">
            <Column selectionMode="multiple" headerStyle="width:3rem" :exportable="false" />
            <Column field="name" header="Name" sortable>
              <template #body="{ data }">
                <NuxtLink :to="`/people/${data.id}`" class="text-[#1976d2] hover:underline">{{ data.name }}</NuxtLink>
              </template>
            </Column>
            <Column v-if="!hiddenCols.includes('roles')" header="Roles" :exportable="false">
              <template #body="{ data }">
                <InlineChips :items="(data.roles ?? []).map(roleLabel)" variant="blue" />
              </template>
            </Column>
            <Column header="Positions" :exportable="false">
              <template #body="{ data }">
                <InlineChips :items="data.positions ?? []" variant="green" />
              </template>
            </Column>
            <Column v-if="!hiddenCols.includes('phone')" field="phone" header="Phone" sortable />
            <Column v-if="!hiddenCols.includes('email')" field="email" header="Email" sortable />
            <Column v-if="canManage" headerStyle="width:3.5rem" :exportable="false">
              <template #body="{ data }">
                <button type="button" class="text-red-500 hover:text-red-700"
                  :title="`Remove ${data.name} from ${group?.name}`" @click="removePerson(data)">
                  <i class="pi pi-times-circle text-base" />
                </button>
              </template>
            </Column>
            <template #empty>
              <div class="p-6 text-center text-sm text-gray-400">
                No people in this group yet.
                <button v-if="canManage" type="button" class="ml-1 text-[#1976d2] hover:underline font-medium" @click="openAdd('member')">Add one</button>
              </div>
            </template>
          </DataTable>
        </div>

        <!-- Bulk action (appears when rows are selected) -->
        <div v-if="peopleSelection.length" class="flex">
          <Button label="Action" icon="pi pi-chevron-down" iconPos="right" outlined severity="secondary"
            :badge="String(peopleSelection.length)" @click="actionMenu.toggle($event)" />
          <Menu ref="actionMenu" :model="actionItems" popup />
        </div>
      </div>

      <!-- SUB GROUPS tab — drag-and-drop assignment board -->
      <div v-show="activeTab === 'subgroups'" class="space-y-3">
        <!-- Top bar: view toggle + columns sit above the right (sub-group) panel -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- drag hint, aligned above the left People column -->
          <p class="w-full lg:w-72 shrink-0 text-xs text-gray-500"><i class="pi pi-arrows-alt text-[10px] mr-1" />Drag people into a sub-group to assign them.</p>
          <SelectButton v-model="boardView" :allowEmpty="false" :options="boardViewOptions"
            optionValue="value" dataKey="value">
            <template #option="{ option }"><i :class="option.icon" :title="option.title" /></template>
          </SelectButton>
          <Button v-if="boardView === 'table'" outlined severity="secondary" icon="pi pi-table" label="Columns"
            class="text-gray-700" @click="boardColsPanel.toggle($event)" />
          <Button icon="pi pi-plus" label="New sub-group" class="ml-auto"
            style="background:#1E2157;border-color:#1E2157" @click="addSubGroupPanel.toggle($event)" />
        </div>

        <!-- New sub-group popover -->
        <Popover ref="addSubGroupPanel" @hide="newSubGroupName = ''">
          <div class="w-64 space-y-3">
            <div>
              <label class="text-xs font-semibold text-gray-500">Name</label>
              <InputText v-model="newSubGroupName" placeholder="e.g. Squad A" class="w-full mt-1" autofocus @keydown.enter="onAddSubGroup" />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-500">Colour</label>
              <div class="flex items-center gap-1.5 mt-1.5">
                <button v-for="c in SUBGROUP_PALETTE" :key="c" type="button" class="w-6 h-6 rounded-full border-2 transition-transform"
                  :class="newSubGroupColor === c ? 'border-gray-800 scale-110' : 'border-transparent'" :style="{ background: c }" @click="newSubGroupColor = c" />
              </div>
            </div>
            <Button label="Add sub-group" icon="pi pi-plus" class="w-full justify-center" :disabled="!newSubGroupName.trim()"
              style="background:#1E2157;border-color:#1E2157" @click="onAddSubGroup" />
          </div>
        </Popover>

        <!-- Columns popover (table view) -->
        <Popover ref="boardColsPanel">
          <div class="w-52 text-sm">
            <div class="text-xs font-semibold text-gray-400 mb-2">Show columns</div>
            <div class="flex flex-col gap-1.5">
              <label v-for="col in personColumns" :key="col.key" class="flex items-center gap-2"
                :class="col.key === 'name' ? 'opacity-50' : 'cursor-pointer'">
                <Checkbox :modelValue="!boardHiddenCols.includes(col.key)" binary :disabled="col.key === 'name'"
                  @update:modelValue="() => toggleBoardCol(col.key)" />
                <span>{{ col.label }}</span>
              </label>
            </div>
          </div>
        </Popover>

        <div class="flex flex-col lg:flex-row gap-4 items-start">
          <!-- Left: one people pool -->
          <div class="w-full lg:w-72 shrink-0">
            <div class="bg-white rounded-lg border-2 transition-colors overflow-hidden"
              :class="dragOverTarget === '__unassigned__' ? 'border-primary' : 'border-gray-200'"
              @dragover.prevent="dragOverTarget = '__unassigned__'" @dragleave="dragOverTarget = '__none__'" @drop.prevent="onDropToSubGroup(null)">
            <div class="bg-primary text-white text-xs font-bold py-3 px-4 flex items-center justify-between">
              <span class="uppercase tracking-wide">People</span>
              <span class="bg-white/20 rounded-full px-2 py-0.5">{{ poolStaff.length + unassignedMembers.length }}</span>
            </div>
            <div class="p-2 min-h-[140px] space-y-1">
              <!-- staff first (can join many sub-groups) -->
              <div v-for="s in poolStaff" :key="'staff-' + s.id" draggable="true" @dragstart="onDragStartPerson($event, s.id, true)"
                class="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 bg-gray-50 cursor-grab active:cursor-grabbing hover:bg-gray-100 text-sm">
                <i class="pi pi-shield text-[10px] text-gray-400 shrink-0" title="Staff member" />
                <span class="truncate font-medium">{{ s.name }}</span>
              </div>
              <!-- divider between staff and members -->
              <div v-if="poolStaff.length && unassignedMembers.length" class="border-t border-gray-200 !my-2" />
              <!-- unassigned members -->
              <div v-for="p in unassignedMembers" :key="p.id" draggable="true" @dragstart="onDragStartPerson($event, p.id, false)"
                class="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 bg-gray-50 cursor-grab active:cursor-grabbing hover:bg-gray-100 text-sm">
                <i class="pi pi-bars text-[10px] text-gray-300 shrink-0" />
                <span class="truncate">{{ p.name }}</span>
              </div>
              <p v-if="!poolStaff.length && !unassignedMembers.length" class="text-xs text-gray-400 italic px-2 py-4 text-center">Everyone is assigned.</p>
            </div>
            </div>
          </div>

          <!-- Right: sub-group columns (grid of cards) or stacked full-width (table) -->
          <div class="flex-1 min-w-0" :class="boardView === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' : 'flex flex-col gap-4'">
            <div v-for="sg in subGroups" :key="sg.id"
              class="bg-white rounded-lg border-2 transition-colors overflow-hidden flex flex-col"
              :class="dragOverTarget === sg.id ? 'border-primary' : 'border-gray-200'"
              @dragover.prevent="dragOverTarget = sg.id" @dragleave="dragOverTarget = '__none__'" @drop.prevent="onDropToSubGroup(sg.id)">
              <div class="text-white text-xs font-bold py-3 px-4 flex items-center justify-between" :style="{ background: sg.color }">
                <span>{{ sg.name }}</span>
                <div class="flex items-center gap-2">
                  <span class="bg-white/25 rounded-full px-2 py-0.5">{{ subGroupCount(sg.id) }}</span>
                  <button type="button" class="text-white/80 hover:text-white" :title="`Delete ${sg.name}`" @click="removeSubGroupDef(sg.id)"><i class="pi pi-trash text-xs" /></button>
                </div>
              </div>
              <div class="min-h-[140px] flex-1">
                <!-- TABLE view -->
                <div v-if="boardView === 'table'" class="overflow-x-auto">
                  <table class="w-full text-sm table-fixed">
                    <colgroup>
                      <col v-for="col in boardColumns" :key="col.key" :class="col.width" />
                      <col class="w-8" />
                    </colgroup>
                    <thead>
                      <tr class="text-left text-xs font-semibold text-gray-500 border-b border-gray-100">
                        <th v-for="col in boardColumns" :key="col.key" class="px-3 py-2">{{ col.label }}</th>
                        <th class="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      <!-- staff (attached, can belong to multiple sub-groups) -->
                      <tr v-for="s in staffInSubGroup(sg.id)" :key="'staff-' + s.id" draggable="true" @dragstart="onDragStartPerson($event, s.id, true)"
                        class="group border-b border-gray-50 hover:bg-gray-50 cursor-grab active:cursor-grabbing">
                        <td v-for="col in boardColumns" :key="col.key" class="px-3 py-2 text-gray-700 align-top">
                          <template v-if="col.key === 'name'">
                            <span class="inline-flex items-center gap-1.5">
                              <i class="pi pi-shield text-[10px] text-gray-400 shrink-0" title="Staff member" />
                              <NuxtLink :to="`/people/${s.id}`" class="text-[#1976d2] hover:underline font-medium">{{ s.name }}</NuxtLink>
                            </span>
                          </template>
                          <template v-else-if="col.key === 'roles'">
                            <div class="flex flex-wrap gap-1">
                              <span v-for="r in s.roles" :key="r" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1976d2]/10 text-[#1976d2] font-medium">{{ roleLabel(r) }}</span>
                              <span v-if="!s.roles.length" class="text-gray-300">—</span>
                            </div>
                          </template>
                          <template v-else>{{ (s as any)[col.key] || '' }}</template>
                        </td>
                        <td class="px-2 text-right align-top">
                          <button type="button" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100" title="Remove staff" @click="removeStaffFromSubGroup(sg.id, s.id)"><i class="pi pi-times-circle text-sm" /></button>
                        </td>
                      </tr>
                      <!-- divider between staff and members -->
                      <tr v-if="staffInSubGroup(sg.id).length && membersInSubGroup(sg.id).length">
                        <td :colspan="boardColumns.length + 1" class="border-t border-gray-200 p-0" />
                      </tr>
                      <!-- members -->
                      <tr v-for="p in membersInSubGroup(sg.id)" :key="p.id" draggable="true" @dragstart="onDragStartPerson($event, p.id, false)"
                        class="group border-b border-gray-50 hover:bg-gray-50 cursor-grab active:cursor-grabbing">
                        <td v-for="col in boardColumns" :key="col.key" class="px-3 py-2 text-gray-700 align-top">
                          <template v-if="col.key === 'name'">
                            <span class="inline-flex items-center gap-1.5">
                              <span class="w-[10px] shrink-0" />
                              <NuxtLink :to="`/people/${p.id}`" class="text-[#1976d2] hover:underline">{{ p.name }}</NuxtLink>
                            </span>
                          </template>
                          <template v-else-if="col.key === 'roles'">
                            <div class="flex flex-wrap gap-1">
                              <span v-for="r in p.roles" :key="r" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1976d2]/10 text-[#1976d2] font-medium">{{ roleLabel(r) }}</span>
                              <span v-if="!p.roles.length" class="text-gray-300">—</span>
                            </div>
                          </template>
                          <template v-else>{{ (p as any)[col.key] || '' }}</template>
                        </td>
                        <td class="px-2 text-right align-top">
                          <button type="button" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100" title="Unassign" @click="assignSubGroup(p.id, null)"><i class="pi pi-times-circle text-sm" /></button>
                        </td>
                      </tr>
                      <tr v-if="!subGroupCount(sg.id)">
                        <td :colspan="boardColumns.length + 1" class="px-3 py-4 text-center text-xs text-gray-300 italic">Drop people here</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <!-- GRID view -->
                <div v-else class="p-2 space-y-1">
                  <!-- staff (attached, can belong to multiple sub-groups) -->
                  <div v-for="s in staffInSubGroup(sg.id)" :key="'staff-' + s.id" draggable="true" @dragstart="onDragStartPerson($event, s.id, true)"
                    class="group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 bg-gray-50 cursor-grab active:cursor-grabbing hover:bg-gray-100 text-sm">
                    <i class="pi pi-shield text-[10px] text-gray-400 shrink-0" title="Staff member" />
                    <span class="truncate flex-1 font-medium">{{ s.name }}</span>
                    <button type="button" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0" title="Remove staff" @click="removeStaffFromSubGroup(sg.id, s.id)"><i class="pi pi-times-circle text-xs" /></button>
                  </div>
                  <!-- divider between staff and members -->
                  <div v-if="staffInSubGroup(sg.id).length && membersInSubGroup(sg.id).length" class="border-t border-gray-200 !my-2" />
                  <!-- members -->
                  <div v-for="p in membersInSubGroup(sg.id)" :key="p.id" draggable="true" @dragstart="onDragStartPerson($event, p.id, false)"
                    class="group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 cursor-grab active:cursor-grabbing hover:bg-gray-50 text-sm">
                    <i class="pi pi-bars text-[10px] text-gray-300 shrink-0" />
                    <span class="truncate flex-1">{{ p.name }}</span>
                    <button type="button" class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0" title="Unassign" @click="assignSubGroup(p.id, null)"><i class="pi pi-times-circle text-xs" /></button>
                  </div>
                  <p v-if="!subGroupCount(sg.id)" class="text-xs text-gray-300 italic px-2 py-4 text-center">Drop people here</p>
                </div>
              </div>
            </div>

            <div v-if="!subGroups.length" class="col-span-full border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
              No sub-groups yet. Name one above and click Add, then drag people in.
            </div>
          </div>
        </div>
      </div>

      <!-- ASSETS -->
      <div v-show="activeTab === 'assets'" class="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-400">
        <i class="pi pi-box text-2xl text-gray-300 block mb-2" />
        Assets for this group will appear here.
      </div>

      <!-- TRAININGS — attendance report matrix (people × sessions) -->
      <div v-show="activeTab === 'trainings'" class="space-y-3">
        <!-- Title + toolbar on one line -->
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-base font-semibold text-gray-800 mr-auto">{{ group?.name }}</h2>
          <template v-if="reportSessions.length">
            <Button outlined severity="secondary" icon="pi pi-filter" label="Filter" class="text-gray-700" @click="reportFilterPanel.toggle($event)" />
            <Button outlined severity="secondary" icon="pi pi-table" label="Columns" class="text-gray-700" @click="reportColsPanel.toggle($event)" />
            <Button icon="pi pi-download" label="Export" style="background:#1E2157;border-color:#1E2157" @click="exportMenu.toggle($event)" />
            <Menu ref="exportMenu" :model="exportItems" popup />
          </template>
        </div>
        <Popover ref="reportFilterPanel">
          <div class="w-64 text-sm space-y-4">
            <div>
              <div class="text-xs font-semibold text-gray-400 mb-2">View</div>
              <Select v-model="reportGrouped" :options="[{ label: 'Complete list', value: false }, { label: 'By sub-group', value: true }]"
                optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <div v-if="slotPickOptions.length > 1">
              <div class="text-xs font-semibold text-gray-400 mb-2">Session</div>
              <Select v-model="selectedSlot" :options="slotPickOptions" optionLabel="label" optionValue="value"
                showClear placeholder="All sessions" class="w-full" />
            </div>
            <div>
              <div class="text-xs font-semibold text-gray-400 mb-2">Show sections</div>
              <div class="flex flex-col gap-1.5">
                <label class="flex items-center gap-2 cursor-pointer"><Checkbox v-model="reportFilter.members" binary /><span>Members</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><Checkbox v-model="reportFilter.staff" binary /><span>Staff</span></label>
                <label class="flex items-center gap-2 cursor-pointer"><Checkbox v-model="reportFilter.visitors" binary /><span>Visitors</span></label>
              </div>
            </div>
            <div>
              <div class="text-xs font-semibold text-gray-400 mb-2">Date range</div>
              <div class="flex items-center gap-2">
                <input type="date" v-model="reportFrom" class="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" style="-webkit-appearance:auto;appearance:auto" />
                <span class="text-gray-400">–</span>
                <input type="date" v-model="reportTo" class="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" style="-webkit-appearance:auto;appearance:auto" />
              </div>
              <button v-if="reportFrom || reportTo" type="button" class="mt-2 text-xs font-semibold text-[#1976d2]" @click="reportFrom = ''; reportTo = ''">Clear dates</button>
            </div>
          </div>
        </Popover>
        <Popover ref="reportColsPanel">
          <div class="w-52 text-sm">
            <div class="text-xs font-semibold text-gray-400 mb-2">Show columns</div>
            <div class="flex flex-col gap-1.5">
              <label v-for="col in personColumns" :key="col.key" class="flex items-center gap-2" :class="col.key === 'name' ? 'opacity-50' : 'cursor-pointer'">
                <Checkbox :modelValue="!reportHiddenCols.includes(col.key)" binary :disabled="col.key === 'name'" @update:modelValue="() => toggleReportCol(col.key)" />
                <span>{{ col.label }}</span>
              </label>
            </div>
          </div>
        </Popover>

        <div v-if="!reportSessions.length" class="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-400">
          <i class="pi pi-calendar text-2xl text-gray-300 block mb-2" />
          No training sessions yet. Add session times (and set a season) on the Details tab.
        </div>
        <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="text-sm border-collapse min-w-full">
              <thead>
                <tr class="border-b-2 border-gray-200">
                  <th v-for="col in reportPersonCols" :key="col.key" class="text-left align-middle px-4 py-3 font-bold text-gray-700 whitespace-nowrap" :class="col.key === 'name' ? 'min-w-[16rem] border-r border-gray-200 sticky left-0 bg-white z-20' : ''">
                    <template v-if="col.key === 'name'">
                      <div class="flex items-center gap-2 h-8">
                        <Transition mode="out-in" enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-100" leave-to-class="opacity-0" @after-enter="onSearchEntered">
                          <InputText v-if="reportSearchOpen" key="input" ref="reportSearchInput" v-model="reportSearch" placeholder="Search name…"
                            class="h-8 text-sm font-normal flex-1 min-w-0 !border-0 !border-b !border-gray-300 !rounded-none !shadow-none !ring-0 focus:!border-primary px-0"
                            @keydown.esc="reportSearchOpen = false" />
                          <span v-else key="label" class="flex-1">{{ col.label }}</span>
                        </Transition>
                        <button type="button" class="text-gray-400 hover:text-gray-700 shrink-0"
                          :title="reportSearchOpen ? 'Close search' : 'Search'"
                          @click="toggleReportSearch">
                          <i class="pi" :class="reportSearchOpen ? 'pi-times' : 'pi-search'" />
                        </button>
                      </div>
                    </template>
                    <template v-else>{{ col.label }}</template>
                  </th>
                  <th v-for="s in visibleSessions" :key="s.key" class="px-2 py-2 text-center font-semibold whitespace-nowrap border-l border-gray-200">
                    <NuxtLink v-if="s.eventId" :to="`/events/${s.eventId}?tab=attendance`" class="text-[#1976d2] hover:underline text-xs leading-tight block">
                      {{ sessDate(s.start_at) }}<br>{{ sessTime(s.start_at) }}
                    </NuxtLink>
                    <span v-else class="text-gray-500 text-xs leading-tight block">{{ sessDate(s.start_at) }}<br>{{ sessTime(s.start_at) }}</span>
                  </th>
                  <th class="px-3 py-2 text-center font-bold sticky right-0 bg-gray-50 z-10 shadow-[inset_2px_0_0_#d1d5db]">Total</th>
                </tr>
              </thead>
              <tbody>
                <!-- MEMBERS -->
                <template v-if="reportFilter.members && (!hasSearch || filteredMembers.length)">
                  <tr class="bg-gray-100/70 border-y border-gray-200">
                    <td :colspan="reportPersonCols.length + visibleSessions.length + 1" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Members</td>
                  </tr>
                  <template v-for="it in memberRowItems" :key="it.kind === 'person' ? 'm-' + it.p.id : 'h-' + it.label">
                    <tr v-if="it.kind === 'header'" class="bg-white border-b border-gray-200">
                      <td :colspan="reportPersonCols.length + visibleSessions.length + 1" class="px-4 py-1.5 text-xs font-semibold text-gray-600">
                        <span class="inline-flex items-center gap-2"><span class="w-2 h-2 rounded-full" :style="{ background: it.color }" />{{ it.label }}</span>
                      </td>
                    </tr>
                    <tr v-else class="border-b border-gray-200 hover:bg-gray-50/60">
                      <td v-for="col in reportPersonCols" :key="col.key" class="px-4 py-2 align-top text-gray-700" :class="col.key === 'name' ? 'border-r border-gray-200 sticky left-0 bg-white z-10' : ''">
                        <NuxtLink v-if="col.key === 'name'" :to="`/people/${it.p.id}`" class="text-[#1976d2] hover:underline">{{ it.p.name }}</NuxtLink>
                        <div v-else-if="col.key === 'roles'" class="flex flex-wrap gap-1"><span v-for="r in it.p.roles" :key="r" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1976d2]/10 text-[#1976d2] font-medium">{{ roleLabel(r) }}</span><span v-if="!it.p.roles.length" class="text-gray-300">—</span></div>
                        <template v-else>{{ (it.p as any)[col.key] || '' }}</template>
                      </td>
                      <td v-for="s in visibleSessions" :key="s.key" class="px-2 py-2 text-center border-l border-gray-200" :class="attended(it.p.id, s.eventId) ? 'bg-green-50' : ''">
                        <i v-if="attended(it.p.id, s.eventId)" class="pi pi-check text-green-600 text-xs" />
                      </td>
                      <td class="px-3 py-2 text-center font-medium sticky right-0 bg-gray-50 z-10 shadow-[inset_2px_0_0_#d1d5db]">{{ personTotal(it.p.id) }}</td>
                    </tr>
                  </template>
                  <tr class="bg-gray-50 border-y-2 border-gray-200 font-bold">
                    <td :colspan="reportPersonCols.length" class="px-4 py-2.5 border-r border-gray-200 sticky left-0 bg-gray-50 z-10">Total members</td>
                    <td v-for="s in visibleSessions" :key="s.key" class="px-2 py-2.5 text-center border-l border-gray-200">{{ sectionTotal(members, s.eventId) }}</td>
                    <td class="px-3 py-2.5 text-center sticky right-0 bg-gray-50 z-10 shadow-[inset_2px_0_0_#d1d5db]">{{ sectionGrand(members) }}</td>
                  </tr>
                </template>

                <!-- STAFF -->
                <template v-if="reportFilter.staff && (!hasSearch || filteredStaff.length)">
                  <tr class="bg-gray-100/70 border-y border-gray-200">
                    <td :colspan="reportPersonCols.length + visibleSessions.length + 1" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Staff</td>
                  </tr>
                  <tr v-for="p in filteredStaff" :key="'s-' + p.id" class="border-b border-gray-200 hover:bg-gray-50/60">
                    <td v-for="col in reportPersonCols" :key="col.key" class="px-4 py-2 align-top text-gray-700" :class="col.key === 'name' ? 'border-r border-gray-200 sticky left-0 bg-white z-10' : ''">
                      <NuxtLink v-if="col.key === 'name'" :to="`/people/${p.id}`" class="text-[#1976d2] hover:underline">{{ p.name }}</NuxtLink>
                      <div v-else-if="col.key === 'roles'" class="flex flex-wrap gap-1"><span v-for="r in p.roles" :key="r" class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1976d2]/10 text-[#1976d2] font-medium">{{ roleLabel(r) }}</span><span v-if="!p.roles.length" class="text-gray-300">—</span></div>
                      <template v-else>{{ (p as any)[col.key] || '' }}</template>
                    </td>
                    <td v-for="s in visibleSessions" :key="s.key" class="px-2 py-2 text-center border-l border-gray-200" :class="attended(p.id, s.eventId) ? 'bg-green-50' : ''">
                      <i v-if="attended(p.id, s.eventId)" class="pi pi-check text-green-600 text-xs" />
                    </td>
                    <td class="px-3 py-2 text-center font-medium sticky right-0 bg-gray-50 z-10 shadow-[inset_2px_0_0_#d1d5db]">{{ personTotal(p.id) }}</td>
                  </tr>
                  <tr class="bg-gray-50 border-y-2 border-gray-200 font-bold">
                    <td :colspan="reportPersonCols.length" class="px-4 py-2.5 border-r border-gray-200 sticky left-0 bg-gray-50 z-10">Total staff</td>
                    <td v-for="s in visibleSessions" :key="s.key" class="px-2 py-2.5 text-center border-l border-gray-200">{{ sectionTotal(coaches, s.eventId) }}</td>
                    <td class="px-3 py-2.5 text-center sticky right-0 bg-gray-50 z-10 shadow-[inset_2px_0_0_#d1d5db]">{{ sectionGrand(coaches) }}</td>
                  </tr>
                </template>

                <!-- VISITORS (only when present) -->
                <template v-if="reportFilter.visitors && visitorPeople.length && (!hasSearch || filteredVisitors.length)">
                  <tr class="bg-gray-100/70 border-y border-gray-200">
                    <td :colspan="reportPersonCols.length + visibleSessions.length + 1" class="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Visitors</td>
                  </tr>
                  <tr v-for="p in filteredVisitors" :key="'v-' + p.id" class="border-b border-gray-200 hover:bg-gray-50/60">
                    <td v-for="col in reportPersonCols" :key="col.key" class="px-4 py-2 align-top text-gray-700" :class="col.key === 'name' ? 'border-r border-gray-200 sticky left-0 bg-white z-10' : ''">
                      <NuxtLink v-if="col.key === 'name'" :to="`/people/${p.id}`" class="text-[#1976d2] hover:underline">{{ p.name }}</NuxtLink>
                      <span v-else-if="col.key === 'roles'" class="text-gray-300">—</span>
                      <template v-else>{{ (p as any)[col.key] || '' }}</template>
                    </td>
                    <td v-for="s in visibleSessions" :key="s.key" class="px-2 py-2 text-center border-l border-gray-200" :class="attended(p.id, s.eventId) ? 'bg-green-50' : ''">
                      <i v-if="attended(p.id, s.eventId)" class="pi pi-check text-green-600 text-xs" />
                    </td>
                    <td class="px-3 py-2 text-center font-medium sticky right-0 bg-gray-50 z-10 shadow-[inset_2px_0_0_#d1d5db]">{{ personTotal(p.id) }}</td>
                  </tr>
                  <tr class="bg-gray-50 border-y-2 border-gray-200 font-bold">
                    <td :colspan="reportPersonCols.length" class="px-4 py-2.5 border-r border-gray-200 sticky left-0 bg-gray-50 z-10">Total visitors</td>
                    <td v-for="s in visibleSessions" :key="s.key" class="px-2 py-2.5 text-center border-l border-gray-200">{{ sectionTotal(visitorPeople, s.eventId) }}</td>
                    <td class="px-3 py-2.5 text-center sticky right-0 bg-gray-50 z-10 shadow-[inset_2px_0_0_#d1d5db]">{{ sectionGrand(visitorPeople) }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <!-- Footer stats -->
          <div v-if="attendanceStats" class="border-t-2 border-gray-200 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-8 text-sm text-gray-600">
            <span><span class="font-semibold text-gray-800">Highest attendance:</span> {{ attendanceStats.high.n }} ({{ fmtDayMonth(attendanceStats.high.at) }})</span>
            <span><span class="font-semibold text-gray-800">Lowest attendance:</span> {{ attendanceStats.low.n }} ({{ fmtDayMonth(attendanceStats.low.at) }})</span>
            <span><span class="font-semibold text-gray-800">Average:</span> {{ attendanceStats.avg }}</span>
          </div>
        </div>
      </div>

      <!-- TRACKER -->
      <div v-show="activeTab === 'tracker'" class="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-400">
        <i class="pi pi-chart-line text-2xl text-gray-300 block mb-2" />
        Tracker for this group will appear here.
      </div>
    </template>

    <!-- Attendance graph -->
    <Dialog v-model:visible="showGraph" modal header="Attendance graph" :style="{ width: '95vw', maxWidth: '900px' }">
      <div v-if="visibleSessions.length" class="h-80">
        <Chart type="bar" :data="attendanceChartData" :options="attendanceChartOptions" class="h-full w-full" />
      </div>
      <p v-else class="text-sm text-gray-400 text-center py-8">No sessions to chart.</p>
    </Dialog>

    <!-- Manage sub-groups -->
    <Dialog v-model:visible="showSubGroupsDialog" modal header="Manage sub-groups" :style="{ width: '95vw', maxWidth: '460px' }">
      <div class="flex flex-col gap-4">
        <!-- Add a sub-group -->
        <div class="flex items-end gap-2">
          <div class="flex-1">
            <label class="text-xs font-semibold text-gray-500">New sub-group</label>
            <InputText v-model="newSubGroupName" placeholder="e.g. Squad A" class="w-full mt-1" @keydown.enter="addSubGroup" />
          </div>
          <div class="flex items-center gap-1">
            <button v-for="c in SUBGROUP_PALETTE" :key="c" type="button"
              class="w-6 h-6 rounded-full border-2 transition-transform"
              :class="newSubGroupColor === c ? 'border-gray-800 scale-110' : 'border-transparent'"
              :style="{ background: c }" @click="newSubGroupColor = c" />
          </div>
          <Button label="Add" :disabled="!newSubGroupName.trim()" @click="addSubGroup"
            style="background:#1E2157;border-color:#1E2157" />
        </div>

        <!-- Existing sub-groups -->
        <div v-if="subGroups.length" class="flex flex-col gap-1.5">
          <div v-for="sg in subGroups" :key="sg.id" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: sg.color }" />
            <span class="text-sm text-gray-800 flex-1">{{ sg.name }}</span>
            <button type="button" class="text-red-500 hover:text-red-700" :title="`Delete ${sg.name}`" @click="removeSubGroupDef(sg.id)">
              <i class="pi pi-trash text-sm" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-400 text-center py-2">No sub-groups yet. Add one above, then assign people from the Sub-group column.</p>
      </div>
      <template #footer>
        <Button label="Done" text @click="showSubGroupsDialog = false" />
      </template>
    </Dialog>

    <!-- Add a person (member and/or staff) -->
    <Dialog v-model:visible="addOpen" modal :style="{ width: '95vw', maxWidth: '520px' }" :header="`Add to ${group ? group.name : 'group'}`">
      <div class="flex flex-col gap-4">
        <!-- Person -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Person</label>
          <AutoComplete v-model="personQuery" :suggestions="personResults" optionLabel="label"
            placeholder="Type a name…" class="w-full" dropdown forceSelection
            @complete="searchPersons" @item-select="onPickPerson" />
        </div>

        <!-- capacity → waitlist warning -->
        <div v-if="addWaitlistWarn" class="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-sm text-amber-800">
          <div class="flex items-start gap-2">
            <i class="pi pi-exclamation-triangle text-amber-500 mt-0.5 shrink-0" />
            <p>This group is <span class="font-semibold">full ({{ members.length }}/{{ group?.capacity }})</span> — add them to the waitlist <span class="font-semibold">{{ groupWaitlist?.name || '—' }}</span>, or to the group anyway.</p>
          </div>

          <!-- equivalent groups with space -->
          <div v-if="siblingsWithSpace.length" class="mt-2.5 pt-2.5 border-t border-amber-200/70">
            <p class="text-[13px] font-medium text-amber-800 mb-1.5">These equivalent groups have space — add them to one instead:</p>
            <div class="flex flex-col gap-1.5">
              <button v-for="s in siblingsWithSpace" :key="s.id" type="button"
                class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-white border border-amber-200 hover:border-primary text-left"
                @click="addToSiblingGroup(s)">
                <span class="text-sm text-gray-800 truncate">{{ s.name }}</span>
                <span class="text-xs text-gray-500 shrink-0">{{ s.count }}<span v-if="s.capacity">/{{ s.capacity }}</span> · <span class="text-primary font-medium">Add here</span></span>
              </button>
            </div>
          </div>
        </div>

        <!-- Position(s) — the member field (most people are members) -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Position(s) <span class="text-gray-400 font-normal">— optional</span></label>
            <button type="button" class="text-xs text-primary hover:underline" @click="showNewPosition = !showNewPosition">+ New position</button>
          </div>
          <MultiSelect v-model="addPositions" :options="positionOptions" optionLabel="label" optionValue="value"
            display="chip" :showToggleAll="false" placeholder="Captain, Vice, Wing…" class="w-full"
            :emptyMessage="'No positions yet — add one with “+ New position”'" />
          <div v-if="showNewPosition" class="flex items-center gap-2">
            <InputText v-model="newAddPosition" placeholder="New position name" class="flex-1" size="small"
              @keydown.enter.prevent="addNewPosition" />
            <Button label="Add" outlined size="small" :disabled="!newAddPosition.trim()" @click="addNewPosition" />
          </div>
        </div>

        <!-- Fee -->
        <div v-if="enrolOptions.length" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Fee <span class="text-gray-400 font-normal">— optional</span></label>
          <Select v-model="addEnrol" :options="enrolOptions" optionLabel="label" optionValue="value"
            placeholder="No fee" showClear class="w-full" />
        </div>

        <!-- Staff — tucked behind a disclosure (most people aren't staff) -->
        <div class="border-t border-gray-100 pt-3">
          <button v-if="!showStaffRoles" type="button" class="text-sm text-primary hover:underline inline-flex items-center gap-1.5" @click="showStaffRoles = true">
            <i class="pi pi-shield text-xs" /> Also a coach or manager?
          </button>
          <div v-else class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium">Staff role(s)</label>
              <button type="button" class="text-xs text-gray-400 hover:text-gray-600" @click="showStaffRoles = false; addRoles = []">Not staff</button>
            </div>
            <MultiSelect v-model="addRoles" :options="codeRoleOptions" optionLabel="label" optionValue="value"
              display="chip" :showToggleAll="false" placeholder="Coach, Manager…" class="w-full" />
            <p class="text-xs text-gray-400">Staff can run this group.
              <NuxtLink v-if="groupCode" :to="`/groups/codes/${groupCode.id}`" class="text-primary hover:underline">Manage code roles →</NuxtLink>
            </p>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="addOpen = false" />
        <template v-if="addWaitlistWarn">
          <Button label="Add to group anyway" text severity="secondary" :disabled="!pendingPerson" @click="addPerson" />
          <Button label="Add to waitlist" icon="pi pi-hourglass" :disabled="!pendingPerson"
            style="background:#1976d2;border-color:#1976d2" @click="addToWaitlist" />
        </template>
        <Button v-else label="Add" :disabled="!pendingPerson"
          style="background:#1976d2;border-color:#1976d2" @click="addPerson" />
      </template>
    </Dialog>

    <!-- Edit group details -->
    <Dialog v-model:visible="billingEditOpen" modal :style="{ width: '95vw', maxWidth: '560px' }" header="Membership & terms">
      <div class="space-y-5">
        <!-- Term (a group belongs to ONE term; roll it over to start a new term) -->
        <div>
          <div class="text-sm font-semibold text-gray-800 mb-1">Term</div>
          <p class="text-xs text-gray-500 mb-2">The term this group runs in. At the end of the term you roll it over to create the next term's group.</p>
          <div v-if="orgTerms.length" class="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select v-model="termDraft.termId" :options="orgTerms" optionLabel="name" optionValue="id"
              showClear placeholder="Not run on a term" class="flex-1" />
            <InputNumber v-if="termDraft.termId" v-model="termDraft.fee"
              mode="currency" :currency="orgCurrency" locale="en-NZ" :min="0" placeholder="Fee"
              class="w-32 shrink-0" :inputStyle="{ width: '8rem' }" />
          </div>
          <p v-else class="text-xs text-gray-400">No terms defined yet —
            <NuxtLink to="/settings/memberships" class="text-primary hover:underline">create terms in Settings</NuxtLink>.
          </p>
        </div>

        <!-- Memberships -->
        <div>
          <div class="text-sm font-semibold text-gray-800 mb-1">Memberships</div>
          <p class="text-xs text-gray-500 mb-2">Connect the recurring membership plans this group offers.</p>
          <div v-if="orgPlans.length" class="space-y-2">
            <div v-for="p in orgPlans" :key="p.id" class="flex items-start gap-2">
              <Checkbox v-model="planDraft[p.id]" :binary="true" :inputId="`plan-${p.id}`" class="mt-0.5" />
              <label :for="`plan-${p.id}`" class="text-sm text-gray-700 cursor-pointer">
                <span class="inline-flex items-center gap-2">
                  <span class="inline-block w-2.5 h-2.5 rounded-full" :style="{ background: p.color || '#1E2157' }" />
                  {{ p.name }}
                </span>
                <span v-if="p.options.length" class="block text-xs text-gray-400 ml-[18px]">
                  {{ p.options.map(o => tm.optionLabel(o, orgCurrency)).join(' · ') }}
                </span>
              </label>
            </div>
          </div>
          <p v-else class="text-xs text-gray-400">No membership plans yet —
            <NuxtLink to="/settings/memberships" class="text-primary hover:underline">create memberships in Settings</NuxtLink>.
          </p>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="billingEditOpen = false" />
        <Button label="Save" :loading="savingBilling" style="background:#1E2157;border-color:#1E2157" @click="saveBilling" />
      </template>
    </Dialog>

    <!-- Shared per-person action menu (See profile / Send message / Email) -->
    <Menu ref="personMenu" :model="personMenuItems" :popup="true" />

    <Dialog v-model:visible="groupEditOpen" modal :style="{ width: '95vw', maxWidth: '480px' }" header="Edit group">
      <div class="flex flex-col gap-3.5">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="groupDraft.name" class="w-full" placeholder="Group name" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Colour</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="c in GROUP_PALETTE" :key="c" type="button"
              class="w-7 h-7 rounded-full border-2 transition"
              :class="groupDraft.color === c ? 'border-gray-800 scale-110' : 'border-white shadow'"
              :style="{ background: c }" @click="groupDraft.color = c" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Image</label>
          <div v-if="!groupDraft.image_url"
            class="border-2 border-dashed border-gray-300 rounded-lg h-28 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-gray-400"
            @click="groupImageInput?.click()">
            <i class="pi pi-image text-xl mb-1" />
            <span class="text-xs">{{ uploadingGroupImage ? 'Uploading…' : 'Add an image' }}</span>
          </div>
          <div v-else class="relative rounded-lg overflow-hidden">
            <img :src="groupDraft.image_url" class="w-full h-28 object-cover" />
            <Button icon="pi pi-times" rounded text severity="secondary"
              class="absolute top-2 right-2 bg-white/80" @click="groupDraft.image_url = null" />
          </div>
          <input ref="groupImageInput" type="file" accept="image/*" class="hidden" @change="onGroupImage" />
        </div>
        <div v-if="codeSelectOptions.length" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Code</label>
          <Select v-model="groupDraft.code_id" :options="codeSelectOptions" optionLabel="label" optionValue="value"
            placeholder="Ungrouped" class="w-full" showClear />
          <p class="text-xs text-gray-400">The container this group lives in — it inherits the code's term.</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Head</label>
          <Select v-model="groupDraft.head_person_id" :options="headPersonOptions" optionLabel="label" optionValue="value"
            placeholder="First coach" class="w-full" :showClear="true" filter />
          <p v-if="!headPersonOptions.length" class="text-xs text-gray-400">Add a coach to the group to pick a head.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Age range</label>
            <InputText v-model="groupDraft.age_range" class="w-full" placeholder="e.g. 6–9" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Capacity</label>
            <InputNumber v-model="groupDraft.capacity" class="w-full" :min="0" :useGrouping="false" placeholder="No limit" />
          </div>
          <div class="flex flex-col gap-1.5 col-span-2">
            <label class="text-sm font-medium">Gender restriction</label>
            <Select v-model="groupDraft.gender_restriction" :options="GENDER_RESTRICTION_OPTIONS"
              optionLabel="label" optionValue="value" placeholder="Open to all" class="w-full" showClear />
          </div>
        </div>
        <div v-if="group?.id" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Disciplines</label>
          <DisciplineLinker entity-type="group" :entity-id="group.id" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="groupEditOpen = false" />
        <Button label="Save" :disabled="!groupDraft.name?.trim() || savingGroup"
          style="background:#1976d2;border-color:#1976d2" @click="saveGroup" />
      </template>
    </Dialog>

    <!-- Fees editor — define the ways a member can pay to join (migration 204) -->
    <Dialog v-model:visible="feesEditOpen" modal :style="{ width: '95vw', maxWidth: '660px' }" header="Fees">
      <div class="space-y-4">
        <p class="text-xs text-gray-500">Add each way a member can choose to pay. Every option can have multiple line items (e.g. Coaching, Registration, Uniform levy).</p>
        <div v-for="(o, oi) in feeDraft" :key="o.id" class="border border-gray-200 rounded-lg p-3 space-y-3">
          <div class="flex items-center gap-2">
            <InputText v-model="o.name" placeholder="Option name (e.g. Full upfront)" class="flex-1" />
            <Button icon="pi pi-trash" text severity="danger" @click="removeFeeOption(oi)" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select v-model="o.fee_type" :options="gf.FEE_TYPES" optionLabel="label" optionValue="value" class="w-full" />
            <div v-if="o.fee_type === 'recurring'" class="flex gap-2">
              <InputNumber v-model="o.period_count" :min="1" class="w-16" :useGrouping="false" showButtons />
              <Select v-model="o.period_unit" :options="PERIOD_UNITS" optionLabel="label" optionValue="value" class="flex-1" />
            </div>
            <InputNumber v-else-if="o.fee_type === 'instalment'" v-model="o.instalment_count" :min="1" placeholder="Number of payments" class="w-full" :useGrouping="false" showButtons />
            <InputNumber v-else-if="o.fee_type === 'concession' || o.fee_type === 'per_session'" v-model="o.session_count" :min="1" placeholder="Number of sessions" class="w-full" :useGrouping="false" showButtons />
          </div>
          <div v-if="o.fee_type === 'recurring'" class="flex items-center gap-2 text-sm text-gray-600">
            <ToggleSwitch v-model="o.auto_renew" /> Auto-renew each period
          </div>
          <div v-if="o.fee_type === 'upfront'" class="flex items-center gap-2 text-sm text-gray-600">
            <ToggleSwitch v-model="o.prorata" /> Pro-rata (reduce the fee when joining mid-term)
          </div>

          <!-- line items -->
          <div>
            <div class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Line items</div>
            <div v-for="(it, ii) in o.items" :key="it.id" class="flex items-center gap-2 mb-1.5">
              <InputText v-model="it.name" placeholder="e.g. Coaching" class="flex-1 min-w-0" />
              <InputNumber v-model="it.amount" mode="currency" :currency="orgCurrency" locale="en-NZ" :min="0" class="w-28 shrink-0" :inputStyle="{ width: '7rem' }" />
              <InputText v-model="it.account" placeholder="GL" class="w-16 shrink-0" title="GL / Xero account code" />
              <Button icon="pi pi-times" text severity="secondary" class="shrink-0" @click="removeFeeItem(o, ii)" />
            </div>
            <div class="flex items-center justify-between mt-1">
              <button type="button" class="text-xs text-primary hover:underline" @click="addFeeItem(o)">+ Add line item</button>
              <span class="text-sm font-semibold text-gray-800">Total {{ gf.priceLabel(o, orgCurrency) }}</span>
            </div>
          </div>
        </div>
        <button type="button" class="text-sm text-primary hover:underline font-medium" @click="addFeeOption">+ Add fee option</button>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="feesEditOpen = false" />
        <Button label="Save" :loading="savingFees" style="background:#1E2157;border-color:#1E2157" @click="saveFees" />
      </template>
    </Dialog>

    <Dialog v-model:visible="editorOpen" modal :style="{ width: '95vw', maxWidth: '720px' }" header="Edit session times">
      <div v-if="!draftSchedules.length" class="text-sm text-gray-400 py-2">
        No sessions yet — add the days and times this group trains.
      </div>
      <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs font-bold text-gray-700 border-b border-gray-200">
            <th class="py-2 pr-3">Name</th>
            <th class="py-2 pr-3">Day</th>
            <th class="py-2 pr-3">Start</th>
            <th class="py-2 pr-3">End</th>
            <th class="py-2 pr-3">Location</th>
            <th class="py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in draftSchedules" :key="i" class="border-b border-gray-100">
            <td class="py-2 pr-3">
              <input v-model="row.name" type="text" placeholder="Optional"
                class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full min-w-[8rem]" />
            </td>
            <td class="py-2 pr-3">
              <select v-model.number="row.day_of_week"
                class="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
                style="-webkit-appearance:auto;appearance:auto;">
                <option v-for="(d, idx) in dayNames" :key="idx" :value="idx">{{ d }}</option>
              </select>
            </td>
            <td class="py-2 pr-3">
              <input v-model="row.start_time" type="time"
                class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
            </td>
            <td class="py-2 pr-3">
              <input v-model="row.end_time" type="time"
                class="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
            </td>
            <td class="py-2 pr-3">
              <button type="button"
                class="w-full text-left border border-gray-300 rounded px-2 py-1.5 text-sm bg-white hover:bg-gray-50 inline-flex items-center justify-between gap-2"
                @click="openLocationPicker(i)">
                <span :class="locationLabel(row.location) ? 'text-gray-800 truncate' : 'text-gray-400'">
                  {{ locationLabel(row.location) || 'Choose location…' }}
                </span>
                <i class="pi pi-pencil text-[10px] text-gray-400 shrink-0" />
              </button>
            </td>
            <td class="py-2 text-right">
              <button type="button"
                class="text-red-500 hover:text-red-700"
                :title="'Remove session'"
                @click="draftSchedules.splice(i, 1)">
                <i class="pi pi-times-circle text-base" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <button type="button"
        class="mt-4 text-xs font-semibold text-[#1976d2] hover:underline inline-flex items-center gap-1"
        @click="addDraftSchedule">
        <i class="pi pi-plus text-[10px]" /> Add session
      </button>

      <template #footer>
        <button type="button"
          class="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900"
          :disabled="savingSchedules"
          @click="editorOpen = false">Cancel</button>
        <button type="button"
          class="px-3 py-1.5 text-sm font-semibold text-white rounded"
          style="background:#1976d2"
          :disabled="savingSchedules"
          @click="saveSchedules">{{ savingSchedules ? 'Saving…' : 'Save' }}</button>
      </template>
    </Dialog>

    <Dialog v-model:visible="locationPickerOpen" modal :style="{ width: '95vw', maxWidth: '640px' }" header="Choose location">
      <LocationEditor v-if="locationDraft" :model-value="[locationDraft]" :multi="false"
        @update:model-value="locs => locationDraft = locs[0]" />
      <template #footer>
        <button type="button"
          class="px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900"
          @click="locationPickerOpen = false">Cancel</button>
        <button type="button"
          class="px-3 py-1.5 text-sm font-semibold text-white rounded"
          style="background:#1976d2"
          @click="applyLocationPicker">Done</button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import type { OrgTerm, MembershipPlan } from '~/composables/useTermsMemberships'
import type { GroupFeeOption } from '~/composables/useGroupFees'
import type { GroupCode } from '~/composables/useGroupCodes'
import type { CodeRoleDef } from '~/composables/useCodeRoles'
const route = useRoute()
const router = useRouter()
const db = useDb()
const { orgId } = useOrg()

interface Group {
  id: string
  name: string
  color: string | null
  code?: string | null
  age_range?: string | null
  current_term?: string | null
  term_fee?: number | null
  capacity?: number | null
  term_id?: string | null
  code_id?: string | null
  lineage_id?: string | null
  rolled_from_group_id?: string | null
  gender_restriction?: string | null
  image_url?: string | null
  head_person_id?: string | null
}
interface Member { id: string; name: string; email: string | null; phone: string | null; roles: string[]; allRoles: string[]; positions?: string[]; subGroupId?: string | null }
interface Coach { id: string; name: string; email: string | null; phone: string | null; roles: string[]; allRoles: string[]; positions?: string[]; subGroupId?: string | null }
import type { LocationEntry } from '~/composables/useLocation'
interface Schedule {
  id: string
  name: string | null
  day_of_week: number
  start_time: string
  end_time: string
  location: LocationEntry
  sort_order: number
}

const group = ref<Group | null>(null)
const members = ref<Member[]>([])
const coaches = ref<Coach[]>([])

// Site-wide top-bar breadcrumb (Groups › {group name}), like the People profile.
useBreadcrumbs([
  { label: 'Groups', to: '/groups' },
  { label: computed(() => group.value?.name || '…') },
])

// Scoped per-resource roles (coach/manager of THIS group can manage it).
const scoped = useScopedRoles()
const groupRoleOptions = computed(() => scoped.rolesFor('group').map(r => ({ label: r.label, value: r.key })))
// Staff roles for THIS group come from its CODE (migration 213): the effective
// roles of the code's lineage = org defaults (Manager/Coach) + inherited + own.
// So adding a staff member offers the roles configured on /groups/codes/:id.
const cr = useCodeRoles()
const codeRoleDefs = ref<CodeRoleDef[]>([])
// Staff assigned at the CODE level (cascade down to this group) — read-only here,
// managed on the code's settings page. Shown below the group-level coaches.
const codeStaffRows = ref<any[]>([])
const codeStaffForGroup = computed(() => groupCode.value
  ? cr.staffForCode(groupCode.value, codesById.value, codeStaffRows.value, codes.value)
  : [])
const codeStaffName = (s: any) => `${s.person?.first_name ?? ''} ${s.person?.last_name ?? ''}`.trim() || s.person?.email || 'Person'
const codeStaffOpen = ref(false)
const codeStaffRoles = computed(() => groupCode.value
  ? cr.rolesForCode(groupCode.value, codesById.value, codeRoleDefs.value)
  // No code → only the org-wide default roles (Manager/Coach) apply.
  : codeRoleDefs.value.filter(d => d.code_lineage_id == null).map(d => ({ ...d, scope: 'default' as const })))
const codeRoleByKey = computed<Record<string, string>>(() =>
  Object.fromEntries(codeStaffRoles.value.map(r => [r.key, r.label])))
const isCodeStaffKey = (k: string) => Object.prototype.hasOwnProperty.call(codeRoleByKey.value, (k || '').toLowerCase())
const codeRoleOptions = computed(() => codeStaffRoles.value.map(r => ({ label: r.label, value: r.key })))
// Filter popover = member roles + this code's staff roles, de-duped by key.
const filterRoleOptions = computed(() => {
  const seen = new Set<string>()
  return [...groupRoleOptions.value, ...codeRoleOptions.value].filter(o => !seen.has(o.value) && seen.add(o.value))
})
// A group staff role = any scoped 'staff' role OR any of this code's staff roles.
const isStaffKey = (k: string) => scoped.roleDef('group', k)?.group === 'staff' || isCodeStaffKey(k)
const rolesAreStaff = (roles: string[]) => roles.some(isStaffKey)
const roleLabel = (key: string) => scoped.roleDef('group', key)?.label ?? codeRoleByKey.value[(key || '').toLowerCase()] ?? key
// A person can hold both staff (coach/manager) and member (player/…) roles and
// therefore appear in BOTH tables. Split a role array into the two sides.
const staffRolesOf = (roles: string[]) => roles.filter(isStaffKey)
const memberRolesOf = (roles: string[]) => roles.filter(r => !isStaffKey(r))
// Normalise stored role keys, preserving this code's staff-role keys (which the
// scoped normaliser would otherwise drop) so custom code roles survive a reload.
function normalizeGroupRoles(rawRoles: any, legacy?: string | null): string[] {
  const arr: any[] = Array.isArray(rawRoles) ? rawRoles : (legacy ? [legacy] : [])
  const out: string[] = []
  for (const raw of arr) {
    const k = String(raw ?? '').trim().toLowerCase()
    if (!k) continue
    if (scoped.roleDef('group', k)) out.push(k)          // exact scoped role
    else if (isCodeStaffKey(k)) out.push(k)              // exact code staff role
    else { const n = scoped.normalizeRole('group', k); if (n) out.push(n) }  // legacy fallback
  }
  return [...new Set(out)]
}
// The org term this group runs on — inherited from its Code (walking up the code
// chain via effectiveTermId), falling back to the group's own term_id.
const groupTerm = computed(() => {
  const tid = gc.effectiveTermId(group.value, codesById.value)
  return tid ? orgTerms.value.find(t => t.id === tid) ?? null : null
})
// The Code this group belongs to (migration 205) — shown as a badge by the title.
const groupCode = computed<GroupCode | null>(() =>
  group.value?.code_id ? codesById.value[group.value.code_id] ?? null : null)
// A group whose term has ended is frozen history — soft-locked (no edits).
const isHistory = computed(() => {
  const end = groupTerm.value?.end_date
  return !!end && end < new Date().toISOString().slice(0, 10)
})
const canManage = computed(() =>
  (group.value ? scoped.canManageGroup(group.value.id) : false) && !isHistory.value)
const myRoleLabels = computed(() => group.value ? scoped.rolesOnGroup(group.value.id).map(roleLabel) : [])

// Shared column definitions for the People table (coaches + members). Both sections
// render from this one list so columns stay aligned and adding a column is a one-liner.
// `name`/`roles` have bespoke cells; every other key reads `row[key]` (extensible).
type PersonCol = { key: string; label: string; width?: string }
const personColumns = ref<PersonCol[]>([
  { key: 'name', label: 'Name', width: 'w-[24%]' },
  { key: 'roles', label: 'Roles', width: 'w-[20%]' },
  { key: 'phone', label: 'Phone', width: 'w-[18%]' },
  { key: 'email', label: 'Email' },
])
// People-tab toolbar: search / filter / sort / columns / export. These only affect
// the People tab — on Details the table shows the raw, unfiltered data.
const peopleSearch = ref('')
const peopleSort = ref<'name-asc' | 'name-desc'>('name-asc')
const roleFilter = ref<string[]>([])
// Hidden-column choices persist in localStorage (per browser) so they survive reloads.
const colsKey = (which: string) => `fm:group-cols:${which}`
function loadHiddenCols(which: string, fallback: string[]) {
  if (!import.meta.client) return fallback
  try { const v = localStorage.getItem(colsKey(which)); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
function saveHiddenCols(which: string, val: string[]) {
  if (import.meta.client) { try { localStorage.setItem(colsKey(which), JSON.stringify(val)) } catch {} }
}
const hiddenCols = ref<string[]>(loadHiddenCols('people', []))
// The People DataTable owns search/filter/column logic.
const inPeopleView = computed(() => activeTab.value === 'people')
const activeColumns = computed(() => inPeopleView.value
  ? personColumns.value.filter(c => !hiddenCols.value.includes(c.key))
  : personColumns.value)
const colCount = computed(() => activeColumns.value.length + (canManage.value ? 1 : 0))
function applyPeopleView(list: any[]) {
  if (!inPeopleView.value) return list
  let out = [...list]
  const q = peopleSearch.value.trim().toLowerCase()
  if (q) out = out.filter(p => `${p.name ?? ''} ${p.email ?? ''} ${p.phone ?? ''}`.toLowerCase().includes(q))
  if (roleFilter.value.length) out = out.filter(p => (p.allRoles ?? p.roles ?? []).some((r: string) => roleFilter.value.includes(r)))
  out.sort((a, b) => peopleSort.value === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name))
  return out
}
const displayCoaches = computed(() => applyPeopleView(coaches.value))
const displayMembers = computed(() => applyPeopleView(members.value))
// Required staff-per-role minimums, resolved from this group's code chain
// (closest code wins — migration 215). Flag any role that's under its minimum.
const roleMinimums = computed(() => group.value ? gc.effectiveRoleMins(group.value, codesById.value) : {})
const staffRoleShortfalls = computed(() => {
  const counts: Record<string, number> = {}
  for (const c of coaches.value) for (const r of (c.roles ?? [])) counts[r] = (counts[r] ?? 0) + 1
  return Object.entries(roleMinimums.value)
    .map(([key, need]) => ({ key, label: roleLabel(key), need, have: counts[key] ?? 0 }))
    .filter(x => x.have < x.need)
})
// Required per-position minimums (e.g. 2 Wings), resolved from the code chain
// (closest wins — migration 217). Count each position across everyone in the group.
const positionMinimums = computed(() => group.value ? gc.effectivePositionMins(group.value, codesById.value) : {})
const positionShortfalls = computed(() => {
  const counts: Record<string, number> = {}
  const seen = new Set<string>()
  for (const p of [...members.value, ...coaches.value]) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    for (const pos of (p.positions ?? [])) counts[pos] = (counts[pos] ?? 0) + 1
  }
  return Object.entries(positionMinimums.value)
    .map(([name, need]) => ({ name, need, have: counts[name] ?? 0 }))
    .filter(x => x.have < x.need)
})
// Coaches + members merged into one deduped list for the single People table.
// allRoles is the full role set per person, so the Roles column shows everything.
const allPeople = computed(() => {
  const map = new Map<string, any>()
  for (const p of [...coaches.value, ...members.value]) {
    if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, email: p.email, phone: p.phone, allRoles: p.allRoles, roles: p.allRoles, positions: p.positions ?? [], subGroupId: p.subGroupId ?? null })
  }
  return Array.from(map.values())
})
const displayPeople = computed(() => applyPeopleView(allPeople.value))
// PrimeVue DataTable selection + export ref + live sort state (so export matches the
// on-screen order: search + role filter via displayPeople, plus the active column sort).
const peopleSelection = ref<any[]>([])
const dt = ref()
const sortField = ref<string>('name')
const sortOrder = ref<number>(1)
const exportRows = computed(() => {
  const rows = [...displayPeople.value]
  const f = sortField.value
  if (f) rows.sort((a, b) => String(a[f] ?? '').localeCompare(String(b[f] ?? '')) * (sortOrder.value || 1))
  return rows
})
// ── Sub-groups (mirrors the event attendance sub-group model) ──
// Stored on member_groups.sub_groups jsonb; per-person assignment lives on
// member_group_memberships.sub_group_id.
// Members assign to ONE sub-group (member_group_memberships.sub_group_id); staff
// (coaches) can be attached to MANY sub-groups, tracked per-sub-group in staffIds.
const subGroups = ref<Array<{ id: string; name: string; color: string; staffIds?: string[] }>>([])
const isStaffPerson = (p: any) => rolesAreStaff(p.allRoles ?? [])
async function addStaffToSubGroup(sgId: string, staffId: string) {
  subGroups.value = subGroups.value.map(s => s.id === sgId
    ? { ...s, staffIds: Array.from(new Set([...(s.staffIds ?? []), staffId])) } : s)
  await persistSubGroups()
}
async function removeStaffFromSubGroup(sgId: string, staffId: string) {
  subGroups.value = subGroups.value.map(s => s.id === sgId
    ? { ...s, staffIds: (s.staffIds ?? []).filter(x => x !== staffId) } : s)
  await persistSubGroups()
}
const subGroupBy = computed<Record<string, { id: string; name: string; color: string }>>(() =>
  Object.fromEntries(subGroups.value.map(s => [s.id, s])))
const subGroupOptions = computed(() => [
  { label: '—', value: null },
  ...subGroups.value.map(s => ({ label: s.name, value: s.id, color: s.color })),
])
const showSubGroupsDialog = ref(false)
const addSubGroupPanel = ref()
const newSubGroupName = ref('')
const SUBGROUP_PALETTE = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#F97316']
const newSubGroupColor = ref(SUBGROUP_PALETTE[0])
async function persistSubGroups() {
  if (!group.value) return
  await (db.from as any)('member_groups').update({ sub_groups: subGroups.value }).eq('id', group.value.id)
}
async function addSubGroup() {
  const name = newSubGroupName.value.trim(); if (!name) return
  subGroups.value = [...subGroups.value, { id: crypto.randomUUID(), name, color: newSubGroupColor.value }]
  newSubGroupName.value = ''
  newSubGroupColor.value = SUBGROUP_PALETTE[subGroups.value.length % SUBGROUP_PALETTE.length]
  await persistSubGroups()
}
async function onAddSubGroup() {
  if (!newSubGroupName.value.trim()) return
  await addSubGroup()
  addSubGroupPanel.value?.hide()
}
async function removeSubGroupDef(sgId: string) {
  subGroups.value = subGroups.value.filter(s => s.id !== sgId)
  await persistSubGroups()
  if (group.value) {
    await (db.from as any)('member_group_memberships').update({ sub_group_id: null })
      .eq('group_id', group.value.id).eq('sub_group_id', sgId)
  }
  const clear = (arr: any[]) => arr.forEach(p => { if (p.subGroupId === sgId) p.subGroupId = null })
  clear(coaches.value); clear(members.value)
}
async function assignSubGroup(personId: string, sgId: string | null) {
  if (!group.value) return
  await (db.from as any)('member_group_memberships').update({ sub_group_id: sgId })
    .eq('group_id', group.value.id).eq('person_id', personId)
  const set = (arr: any[]) => { const r = arr.find(p => p.id === personId); if (r) r.subGroupId = sgId }
  set(coaches.value); set(members.value)
}

// ── Sub Groups drag-and-drop board ──
const boardView = ref<'table' | 'grid'>('grid')
const boardViewOptions = [
  { value: 'table', icon: 'pi pi-list', title: 'Table view' },
  { value: 'grid', icon: 'pi pi-th-large', title: 'Grid view' },
]
const boardHiddenCols = ref<string[]>(loadHiddenCols('subgroups', ['email'])) // table-view columns
const boardColsPanel = ref()
const boardColumns = computed(() => personColumns.value.filter(c => !boardHiddenCols.value.includes(c.key)))
function toggleBoardCol(key: string) {
  boardHiddenCols.value = boardHiddenCols.value.includes(key) ? boardHiddenCols.value.filter(k => k !== key) : [...boardHiddenCols.value, key]
  saveHiddenCols('subgroups', boardHiddenCols.value)
}
const draggingPersonId = ref<string | null>(null)
const draggingIsStaff = ref(false)
const dragOverTarget = ref<string>('__none__') // sub-group id or '__unassigned__'
const sortByName = (a: any, b: any) => a.name.localeCompare(b.name)
// Left pool: members not yet assigned + every staff member (staff can join many).
const unassignedMembers = computed(() => allPeople.value.filter(p => !isStaffPerson(p) && !p.subGroupId).sort(sortByName))
const poolStaff = computed(() => allPeople.value.filter(isStaffPerson).sort(sortByName))
function membersInSubGroup(sgId: string) {
  return allPeople.value.filter(p => !isStaffPerson(p) && p.subGroupId === sgId).sort(sortByName)
}
function staffInSubGroup(sgId: string) {
  const ids = (subGroupBy.value[sgId] as any)?.staffIds ?? []
  return poolStaff.value.filter(p => ids.includes(p.id))
}
function subGroupCount(sgId: string) { return membersInSubGroup(sgId).length + staffInSubGroup(sgId).length }
function onDragStartPerson(e: DragEvent, personId: string, isStaff: boolean) {
  draggingPersonId.value = personId; draggingIsStaff.value = isStaff
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
async function onDropToSubGroup(sgId: string | null) {
  const pid = draggingPersonId.value, staff = draggingIsStaff.value
  draggingPersonId.value = null; dragOverTarget.value = '__none__'
  if (!pid) return
  if (staff) {
    // Staff: add to the target (multi); dropping on the pool is a no-op (they live there).
    if (sgId) await addStaffToSubGroup(sgId, pid)
  } else {
    await assignSubGroup(pid, sgId) // member: single assignment (null = back to pool)
  }
}

// Bulk actions on the selected rows (People tab).
const toast = useToast()
const actionMenu = ref()
const actionItems = computed(() => [
  { label: 'Create Event', icon: 'pi pi-calendar-plus', command: () => bulkAction('Create Event') },
  { label: 'Invoice', icon: 'pi pi-dollar', command: () => bulkAction('Invoice') },
  { label: 'Email', icon: 'pi pi-envelope', command: () => bulkAction('Email') },
  { label: 'Notify', icon: 'pi pi-bell', command: () => bulkAction('Notify') },
])
function bulkAction(name: string) {
  const n = peopleSelection.value.length
  toast.add({ severity: 'info', summary: name, detail: `${name} for ${n} selected ${n === 1 ? 'person' : 'people'} (coming soon)`, life: 2500 })
}
function exportPeopleVisible() {
  const cols = personColumns.value.filter(c => !hiddenCols.value.includes(c.key))
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const cell = (p: any, key: string) => key === 'roles' ? (p.roles ?? []).map(roleLabel).join('; ') : (p[key] ?? '')
  const csv = [cols.map(c => c.label), ...exportRows.value.map(p => cols.map(c => cell(p, c.key)))]
    .map(r => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${(group.value?.name ?? 'group').replace(/\s+/g, '-')}-people.csv`; a.click()
  URL.revokeObjectURL(url)
}
function toggleHiddenCol(key: string) {
  hiddenCols.value = hiddenCols.value.includes(key) ? hiddenCols.value.filter(k => k !== key) : [...hiddenCols.value, key]
  saveHiddenCols('people', hiddenCols.value)
}
function toggleRoleFilter(key: string) {
  roleFilter.value = roleFilter.value.includes(key) ? roleFilter.value.filter(k => k !== key) : [...roleFilter.value, key]
}
const sortPanel = ref()
const filterPanel = ref()
const colsPanel = ref()
function exportPeopleCsv() {
  const cols = activeColumns.value
  const head = ['Section', ...cols.map(c => c.label)]
  const rowFor = (p: any, section: string) => [section, ...cols.map(c =>
    c.key === 'roles' ? (p.roles ?? []).map(roleLabel).join('; ') : (p[c.key] ?? ''))]
  const rows = [
    ...coaches.value.map(c => rowFor(c, 'Coach/Manager')),
    ...members.value.map(m => rowFor(m, 'Member')),
  ]
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${(group.value?.name ?? 'group').replace(/\s+/g, '-')}-people.csv`; a.click()
  URL.revokeObjectURL(url)
}

// Per-section selection. The band checkbox toggles "select mode" (turns each row's
// profile icon into a checkbox); row checkboxes collect ids into the sel arrays.
const coachSelMode = ref(false)
const memberSelMode = ref(false)
const coachSel = ref<string[]>([])
const memberSel = ref<string[]>([])
function setCoachSelMode(v: boolean) { coachSelMode.value = v; if (!v) coachSel.value = [] }
function setMemberSelMode(v: boolean) { memberSelMode.value = v; if (!v) memberSel.value = [] }
function toggleRowSel(section: 'coach' | 'member', id: string, checked: boolean) {
  const arr = section === 'coach' ? coachSel : memberSel
  arr.value = checked ? Array.from(new Set([...arr.value, id])) : arr.value.filter(x => x !== id)
}

// Page tabs (Details holds the current INFO/sessions/people; the rest are stubs for now).
const groupTabs = [
  { key: 'details', label: 'Details', icon: 'pi-info-circle' },
  { key: 'people', label: 'People', icon: 'pi-users' },
  { key: 'subgroups', label: 'Sub Groups', icon: 'pi-sitemap' },
  { key: 'assets', label: 'Assets', icon: 'pi-box' },
  { key: 'trainings', label: 'Trainings', icon: 'pi-check-square' },
  { key: 'tracker', label: 'Tracker', icon: 'pi-chart-line' },
]
const activeTab = ref<string>((typeof route.hash === 'string' && route.hash.slice(1)) || 'details')
watch(activeTab, t => router.replace({ hash: t === 'details' ? '' : `#${t}` }))
const schedules = ref<Schedule[]>([])
const bookableNameById = ref<Record<string, string>>({})
const trainingEventByScheduleId = ref<Record<string, { id: string; title: string }>>({})
const seasonStart = ref<string | null>(null)
const seasonEnd = ref<string | null>(null)
const loading = ref(true)
const creatingEvent = ref(false)

// ---- Terms & memberships (billing) ----
const tm = useTermsMemberships()
const gf = useGroupFees()
const gc = useGroupCodes()
const wl = useWaitlists()
// The waitlist this group is connected to (migration 221) — shown in INFO.
const groupWaitlist = ref<{ id: string; name: string; count: number } | null>(null)
async function loadGroupWaitlist(waitlistId: string | null | undefined) {
  if (!waitlistId) { groupWaitlist.value = null; return }
  const [lists, counts] = await Promise.all([wl.loadWaitlists(), wl.entryCounts()])
  const w = lists.find(x => x.id === waitlistId)
  groupWaitlist.value = w ? { id: w.id, name: w.name, count: counts[w.id] ?? 0 } : null
}
const { uploadFile } = useUpload()
// Global notes permission (edit/delete). Author edit is handled in <PersonNotes>.
const rbac = useCan()
onMounted(() => rbac.load())
const canEditNotes = computed(() => rbac.can('notes', 'update'))
const canDeleteNotes = computed(() => rbac.can('notes', 'delete'))

// The member (person) type this group captures, inherited from its code chain
// (migration 213). Members added here are stamped with it so they get the right
// custom fields.
const policy = useOrgFieldPolicy()
const personTypeLabels = ref<Record<string, string>>({})
const groupMemberType = computed(() => group.value ? gc.effectiveMemberType(group.value, codesById.value) : null)
const groupMemberTypeLabel = computed(() => groupMemberType.value ? (personTypeLabels.value[groupMemberType.value] || groupMemberType.value) : null)
async function ensurePersonType(personId: string, typeKey: string) {
  const { data: person } = await (db.from as any)('persons').select('person_types, person_type').eq('id', personId).maybeSingle()
  const current: string[] = Array.isArray(person?.person_types) ? person!.person_types : (person?.person_type ? [person.person_type] : [])
  if (current.includes(typeKey)) return
  await (db.from as any)('persons').update({ person_types: [...current, typeKey], person_type: person?.person_type || typeKey }).eq('id', personId)
}

// Head picker: only the group's STAFF (coaches) — a head is a staff member.
const headPersonOptions = computed(() => {
  const seen = new Set<string>()
  const opts: { label: string; value: string }[] = []
  for (const p of coaches.value) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    opts.push({ label: p.name, value: p.id })
  }
  return opts
})
// Codes (migration 205) — for the code badge + inherited term. Loaded in load().
const codes = ref<GroupCode[]>([])
const codesById = computed<Record<string, GroupCode>>(() =>
  Object.fromEntries(codes.value.map(c => [c.id, c])))
const codeSelectOptions = computed(() => {
  // Indented tree order so nesting reads clearly in the move-to-code Select.
  const byParent: Record<string, GroupCode[]> = {}
  for (const c of [...codes.value].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)))
    (byParent[c.parent_id ?? '__root'] ??= []).push(c)
  const out: { label: string; value: string }[] = []
  const walk = (key: string, depth: number) => {
    for (const c of (byParent[key] ?? [])) { out.push({ label: `${'  '.repeat(depth)}${c.name}`, value: c.id }); walk(c.id, depth + 1) }
  }
  walk('__root', 0)
  return out
})
const feeOptions = ref<GroupFeeOption[]>([])
const orgTerms = ref<OrgTerm[]>([])
const orgPlans = ref<MembershipPlan[]>([])
const groupTermLinks = ref<{ term_id: string; fee: number | null }[]>([])
const groupPlanLinks = ref<{ plan_id: string }[]>([])
const orgCurrency = ref('NZD')
const billingEditOpen = ref(false)
const savingBilling = ref(false)
// drafts edited in the dialog
const termDraft = ref<{ termId: string | null; fee: number | null }>({ termId: null, fee: null })
const planDraft = ref<Record<string, boolean>>({})

const linkedTerms = computed(() =>
  groupTermLinks.value
    .map(l => ({ ...l, term: orgTerms.value.find(t => t.id === l.term_id) }))
    .filter(l => l.term)
)

// Signup readiness — what still blocks a member from being able to sign up to
// this group. Mirrors the Classes board's Live/Not-live gate + the old report
// reasons; surfaced as an alert in the INFO card.
const signupIssues = computed<string[]>(() => {
  const issues: string[] = []
  if (!feeOptions.value.length) issues.push('No fee option yet — add one in the Fees section so members can choose how to pay.')
  if (isHistory.value) issues.push('This group’s term has ended.')
  return issues
})
const signupReady = computed(() => signupIssues.value.length === 0)

// Fees summary for the INFO card row: the single fee's price when there's one,
// "N fee options" for many, null for none. The button beside it opens the fee
// editor (Add / Edit / See).
const termFeeLabel = computed(() => {
  const n = feeOptions.value.length
  if (n === 0) return null
  if (n === 1) return gf.priceLabel(feeOptions.value[0], orgCurrency.value)
  return `${n} fee options`
})
const feeBtnLabel = computed(() =>
  feeOptions.value.length === 0 ? 'Add a fee' : feeOptions.value.length === 1 ? 'Edit' : 'See fees')
// "How do you want to pay?" — the fee options this group offers (migration 204).
const addEnrol = ref<string | null>(null) // a group_fee_options.id | null
const enrolOptions = computed(() =>
  feeOptions.value.map(o => ({ label: `${o.name} · ${gf.priceLabel(o, orgCurrency.value)}`, value: o.id })))
// Stamp the chosen fee option + the group's term window onto the membership row.
function enrolPatch(): Record<string, any> | null {
  const id = addEnrol.value
  if (!id) return null
  const t = groupTerm.value
  return {
    fee_option_id: id,
    term_id: group.value?.term_id ?? null,
    start_date: t?.start_date ?? null,
    end_date: t?.end_date ?? null,
    membership_status: 'active',
  }
}
const linkedPlans = computed(() =>
  groupPlanLinks.value
    .map(l => orgPlans.value.find(p => p.id === l.plan_id))
    .filter(Boolean) as MembershipPlan[]
)

async function loadBilling(gid = group.value?.id) {
  if (!gid) return
  // All four are independent (terms/plans key off org, the group links off gid),
  // so fire them in one wave rather than gating loadGroupBilling behind the rest.
  const [terms, plans, fees, billing] = await Promise.all([
    tm.loadTerms(), tm.loadPlans(), gf.loadFeeOptions(gid), tm.loadGroupBilling(gid),
  ])
  orgTerms.value = terms
  orgPlans.value = plans
  feeOptions.value = fees
  groupTermLinks.value = billing.terms
  groupPlanLinks.value = billing.plans
}

// ── Fees editor (group_fee_options + line items, migration 204) ──
const PERIOD_UNITS = [{ label: 'week', value: 'week' }, { label: 'month', value: 'month' }, { label: 'year', value: 'year' }]
const feesEditOpen = ref(false)
const savingFees = ref(false)
const feeDraft = ref<GroupFeeOption[]>([])
let feeTmpId = 0
const nextFeeId = () => `tmp-${feeTmpId++}`

function blankFeeOption(): GroupFeeOption {
  return {
    id: nextFeeId(), name: '', fee_type: 'upfront', period_unit: 'month', period_count: 1,
    auto_renew: false, instalment_count: 1, session_count: 10, prorata: false,
    description: null, sort_order: feeDraft.value.length, status: 'active',
    items: [{ id: nextFeeId(), name: '', amount: 0, account: null, sort_order: 0 }],
  }
}
function openFeesEditor() {
  // deep clone so Cancel discards
  feeDraft.value = feeOptions.value.map(o => ({
    ...o,
    items: (o.items || []).map(i => ({ ...i })),
  }))
  if (!feeDraft.value.length) feeDraft.value = [blankFeeOption()]
  feesEditOpen.value = true
}
function addFeeOption() { feeDraft.value.push(blankFeeOption()) }
function removeFeeOption(i: number) { feeDraft.value.splice(i, 1) }
function addFeeItem(o: GroupFeeOption) {
  o.items.push({ id: nextFeeId(), name: '', amount: 0, account: null, sort_order: o.items.length })
}
function removeFeeItem(o: GroupFeeOption, i: number) { o.items.splice(i, 1) }
async function saveFees() {
  if (!group.value?.id) return
  savingFees.value = true
  try {
    await gf.saveFeeOptions(group.value.id, feeDraft.value.filter(o => o.name?.trim() || o.items.some(i => i.name || i.amount)))
    feeOptions.value = await gf.loadFeeOptions(group.value.id)
    feesEditOpen.value = false
    toast.add({ severity: 'success', summary: 'Fees saved', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save fees', detail: e?.message, life: 4000 })
  } finally {
    savingFees.value = false
  }
}

function openBillingEditor() {
  // The group's term comes from member_groups.term_id; fall back to a legacy
  // member_group_terms link (pre-clone-per-term groups) for the fee.
  const legacy = groupTermLinks.value[0]
  termDraft.value = {
    termId: group.value?.term_id ?? legacy?.term_id ?? null,
    fee: group.value?.term_fee ?? legacy?.fee ?? null,
  }
  planDraft.value = Object.fromEntries(orgPlans.value.map(p => [p.id, groupPlanLinks.value.some(l => l.plan_id === p.id)]))
  billingEditOpen.value = true
}

async function saveBilling() {
  if (!group.value?.id) return
  savingBilling.value = true
  try {
    const gid = group.value.id
    const termId = termDraft.value.termId
    const fee = termDraft.value.fee ?? null
    const termName = termId ? (orgTerms.value.find(t => t.id === termId)?.name ?? null) : null

    // The group's single term lives on member_groups (drives the term filter,
    // history and rollover). Keep member_group_terms in sync (one row) so the
    // enrol picker + read-side card keep working.
    await (db.from as any)('member_groups')
      .update({ term_id: termId, term_fee: fee, current_term: termName })
      .eq('id', gid)
    await (db.from as any)('member_group_terms').delete().eq('group_id', gid)
    await (db.from as any)('member_group_plans').delete().eq('group_id', gid)
    if (termId) await (db.from as any)('member_group_terms').insert({ group_id: gid, term_id: termId, fee })
    const planRows = orgPlans.value
      .filter(p => planDraft.value[p.id])
      .map(p => ({ group_id: gid, plan_id: p.id }))
    if (planRows.length) await (db.from as any)('member_group_plans').insert(planRows)
    // Reflect locally so the INFO card / term badge / filter update immediately.
    if (group.value) { group.value.term_id = termId; group.value.term_fee = fee; group.value.current_term = termName }
    groupTermLinks.value = termId ? [{ term_id: termId, fee }] : []
    groupPlanLinks.value = planRows.map(r => ({ plan_id: r.plan_id }))
    billingEditOpen.value = false
    toast.add({ severity: 'success', summary: 'Membership & terms saved', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 4000 })
  } finally {
    savingBilling.value = false
  }
}

const missingTrainingEvents = computed(() =>
  schedules.value.filter(s => !trainingEventByScheduleId.value[s.id])
)

const createBlockedReason = computed(() => {
  if (!schedules.value.length) return 'Add session times first'
  if (!missingTrainingEvents.value.length) return 'All training events created'
  return ''
})
// Org season is the preferred window; fall back to today → +4 months if unset.
function effectiveSeason() {
  const today = new Date()
  const start = seasonStart.value || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  let endIso = seasonEnd.value
  if (!endIso) { const e = new Date(today); e.setMonth(e.getMonth() + 4); endIso = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}` }
  return { start, end: endIso }
}

const createButtonLabel = computed(() => {
  const total = schedules.value.length
  const missing = missingTrainingEvents.value.length
  if (!total) return 'Create training events'
  if (missing === total) return `Create ${total} training event${total === 1 ? '' : 's'}`
  return `Create ${missing} missing training event${missing === 1 ? '' : 's'}`
})

const editorOpen = ref(false)
const draftSchedules = ref<Schedule[]>([])
const savingSchedules = ref(false)

const locationPickerOpen = ref(false)
const locationPickerIndex = ref<number | null>(null)
const locationDraft = ref<LocationEntry | null>(null)

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const headCoach = computed(() => {
  const id = group.value?.head_person_id
  if (id) {
    const p = [...coaches.value, ...members.value].find(x => x.id === id)
    if (p) return p.name
  }
  return coaches.value[0]?.name ?? ''
})

// ── Person notes (Details roster) — rendered by the reusable <PersonNotes>.
// The page only batch-loads the per-person counts (so the roster doesn't fire N
// queries) and supplies the links/context; the component owns the dialog + CRUD.
// Notes are person_notes rows whose `links` carry this group + term, so they also
// surface in each person's profile Notes feed.
const noteCounts = ref<Record<string, number>>({})
const noteLinks = computed(() => {
  const links: { type: string; id: string; label?: string }[] = []
  if (group.value) links.push({ type: 'group', id: group.value.id, label: group.value.name })
  const t = groupTerm.value
  if (t) links.push({ type: 'term', id: t.id, label: t.name })
  return links
})
const noteContextLabel = computed(() =>
  [group.value?.name, groupTerm.value?.name].filter(Boolean).join(' · '))

// Per-person action menu on the roster avatar (See profile / Send message / Email).
const personMenu = ref()
const personMenuItems = ref<any[]>([])
function openPersonMenu(e: Event, p: { id: string; name: string; email: string | null; phone: string | null }) {
  personMenuItems.value = [
    { label: 'See profile', icon: 'pi pi-user', command: () => navigateTo(`/people/${p.id}`) },
    { label: 'Send message', icon: 'pi pi-mobile', disabled: !p.phone, command: () => { if (p.phone) window.location.href = `sms:${p.phone}` } },
    { label: 'Email', icon: 'pi pi-envelope', disabled: !p.email, command: () => { if (p.email) window.location.href = `mailto:${p.email}` } },
  ]
  personMenu.value?.toggle(e)
}
const noteInThisGroup = (n: any) => Array.isArray(n.links) && n.links.some((l: any) => l.type === 'group' && l.id === group.value?.id)

async function loadNoteCounts() {
  const ids = [...coaches.value, ...members.value].map(p => p.id)
  if (!group.value || !ids.length) { noteCounts.value = {}; return }
  const { data } = await (db.from as any)('person_notes').select('person_id, links').in('person_id', ids)
  const counts: Record<string, number> = {}
  for (const n of (data ?? [])) if (noteInThisGroup(n)) counts[n.person_id] = (counts[n.person_id] || 0) + 1
  noteCounts.value = counts
}

async function load() {
  if (!orgId.value) return
  const id = route.params.id as string
  loading.value = true

  // The group row is looked up by its own id, and everything else keys off that
  // same id (or the org), all of which are known upfront — so fire the whole
  // load as ONE parallel wave instead of gating the batch behind the group fetch.
  // loadEvents/loadBilling populate their own refs; attendance runs afterwards
  // since it needs both the event list and the resolved roster.
  const [gRes, membersRes, , schedsRes, bkblsRes, orgRes, , codesList, codeDefs, codeStaffList] = await Promise.all([
    (db.from as any)('member_groups')
      .select('id, name, color, code, code_id, age_range, capacity, current_term, term_fee, sub_groups, term_id, lineage_id, rolled_from_group_id, gender_restriction, image_url, head_person_id, waitlist_id')
      .eq('id', id)
      .eq('org_id', orgId.value)
      .maybeSingle(),
    (db.from as any)('member_group_memberships')
      .select('roles, role, positions, sub_group_id, person:persons!inner(id, first_name, last_name, email, phone)')
      .eq('group_id', id),
    loadEvents(id),
    (db.from as any)('member_group_schedules')
      .select('id, name, day_of_week, start_time, end_time, location, sort_order')
      .eq('group_id', id)
      .order('day_of_week')
      .order('start_time'),
    (db.from as any)('bookables')
      .select('id, name')
      .eq('org_id', orgId.value)
      .eq('type', 'VENUE'),
    (db.from as any)('organisations')
      .select('season_start, season_end, currency')
      .eq('id', orgId.value)
      .maybeSingle(),
    loadBilling(id),
    gc.loadCodes(),
    cr.ensureDefaults(),
    cr.loadStaff(),
  ])

  codes.value = codesList ?? []
  codeRoleDefs.value = codeDefs ?? []
  codeStaffRows.value = codeStaffList ?? []
  if (orgId.value && !Object.keys(personTypeLabels.value).length) {
    const types = await policy.resolvePersonTypes(orgId.value)
    personTypeLabels.value = Object.fromEntries((types ?? []).map((t: any) => [t.key, t.label]))
  }
  const g = gRes?.data
  group.value = g ?? null
  if (!g) { members.value = []; loading.value = false; return }
  subGroups.value = Array.isArray(g.sub_groups) ? g.sub_groups : []
  loadGroupWaitlist(g.waitlist_id)

  // Members + coaches — both are member_group_memberships rows. A person can
  // hold multiple roles; anyone with a 'staff' role (Coach/Manager/Assistant)
  // shows in the COACHES & MANAGERS card, everyone else in MEMBERS.
  const rows = membersRes?.data
  const mapped = (rows ?? [])
    .map((r: any) => ({ roles: normalizeGroupRoles(r.roles, r.role), positions: Array.isArray(r.positions) ? r.positions : [], subGroupId: r.sub_group_id ?? null, p: r.person }))
    .filter((x: any) => x.p)
  const named = (x: any) => `${x.p.first_name ?? ''} ${x.p.last_name ?? ''}`.trim() || '—'
  // A person appears in MEMBERS if they hold a position, a non-staff role, or no
  // staff role at all; and in COACHES if they hold a staff role — so a person can
  // be BOTH staff and a member (e.g. a coach who also plays Wing).
  members.value = mapped
    .filter((x: any) => x.positions?.length || !rolesAreStaff(x.roles) || memberRolesOf(x.roles).length)
    .map((x: any) => ({ id: x.p.id, name: named(x), email: x.p.email ?? null, phone: x.p.phone ?? null, roles: memberRolesOf(x.roles), allRoles: x.roles, positions: x.positions, subGroupId: x.subGroupId }))
    .sort((a: Member, b: Member) => a.name.localeCompare(b.name))
  coaches.value = mapped
    .filter((x: any) => rolesAreStaff(x.roles))
    .map((x: any) => ({ id: x.p.id, name: named(x), email: x.p.email ?? null, phone: x.p.phone ?? null, roles: staffRolesOf(x.roles), allRoles: x.roles, positions: x.positions, subGroupId: x.subGroupId }))
    .sort((a: Coach, b: Coach) => a.name.localeCompare(b.name))

  // Weekly training schedules for this group.
  schedules.value = ((schedsRes?.data) ?? []).map((s: any) => ({
    ...s,
    location: normalizeLocation(s.location),
  })) as Schedule[]

  // Bookable names for the read-only summary line in the panel.
  bookableNameById.value = Object.fromEntries(((bkblsRes?.data) ?? []).map((b: any) => [b.id, b.name]))

  // Org-level season range (set in /settings General tab).
  const orgRow = orgRes?.data
  seasonStart.value = orgRow?.season_start ?? null
  seasonEnd.value = orgRow?.season_end ?? null
  orgCurrency.value = orgRow?.currency || 'NZD'

  // Attendance needs both the event list (loadEvents) and the resolved roster.
  await loadAttendance()
  await loadNoteCounts()

  loading.value = false
}

// All future events linked to this group (master + child occurrences), soonest first.
const upcomingEvents = ref<Array<{ id: string; title: string; start_at: string; end_at: string | null; location: any }>>([])
// Upcoming events module: show the next 5, expandable to the full list.
const showAllUpcoming = ref(false)
const visibleUpcoming = computed(() => showAllUpcoming.value ? upcomingEvents.value : upcomingEvents.value.slice(0, 5))
// All training sessions (events) for this group — past + future — for the Trainings tab.
const trainingSessions = ref<Array<{ id: string; title: string; start_at: string; end_at: string | null; location: any }>>([])

// ONE query for every event linked to this group, from which we derive the
// per-schedule master map, the upcoming list, and the full session list —
// collapsing what used to be three separate round-trips on the events table.
// Master events carry member_group_schedule_id (one per schedule row); child
// occurrences inherit member_group_id but leave that column null.
async function loadEvents(gid = group.value?.id) {
  if (!gid) {
    trainingEventByScheduleId.value = {}
    upcomingEvents.value = []
    trainingSessions.value = []
    return
  }
  const { data } = await (db.from as any)('events')
    .select('id, title, start_at, end_at, locations, member_group_schedule_id')
    .eq('member_group_id', gid)
    .order('start_at', { ascending: true })
  // events.locations is a jsonb array of LocationEntry; consumers here render a
  // single `.location`, so surface the first entry. (The old code selected a
  // non-existent `location` column and silently got empty lists.)
  const rows = (data ?? []).map((e: any) => ({
    ...e,
    location: Array.isArray(e.locations) ? (e.locations[0] ?? null) : (e.locations ?? null),
  }))
  const map: Record<string, { id: string; title: string }> = {}
  for (const e of rows) {
    if (e.member_group_schedule_id) map[e.member_group_schedule_id] = { id: e.id, title: e.title }
  }
  trainingEventByScheduleId.value = map
  const nowT = Date.now()
  upcomingEvents.value = rows.filter((e: any) => new Date(e.start_at).getTime() >= nowT).slice(0, 50)
  trainingSessions.value = rows
}
const nowMs = ref(Date.now())
const upcomingSessions = computed(() => trainingSessions.value.filter(e => new Date(e.start_at).getTime() >= nowMs.value))
const pastSessions = computed(() => trainingSessions.value.filter(e => new Date(e.start_at).getTime() < nowMs.value).reverse())
// Columns for the attendance report: real event occurrences if any exist, otherwise
// the weekly schedules projected across the season term (so the report still shows).
// A "slot" identifies a weekly session by weekday + start time (e.g. Mon 13:00),
// so the two Monday sessions (1pm vs 3pm) are distinct choices.
const slotOf = (iso: string) => { const d = new Date(iso); return `${d.getDay()}-${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const reportSessions = computed<Array<{ key: string; eventId: string | null; start_at: string; slot: string }>>(() => {
  if (trainingSessions.value.length) {
    return trainingSessions.value.map(s => ({ key: s.id, eventId: s.id, start_at: s.start_at, slot: slotOf(s.start_at) }))
  }
  const { start, end } = effectiveSeason()
  const startD = new Date(start + 'T00:00:00'); const endD = new Date(end + 'T23:59:59')
  if (isNaN(startD.getTime())) return []
  const out: Array<{ key: string; eventId: string | null; start_at: string; slot: string }> = []
  for (const sch of schedules.value) {
    const d = new Date(startD)
    d.setDate(d.getDate() + (((sch.day_of_week ?? 0) - d.getDay() + 7) % 7))
    while (d <= endD) {
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const at = `${ymd}T${(sch.start_time || '00:00')}`
      out.push({ key: `${sch.id}-${ymd}`, eventId: null, start_at: at, slot: slotOf(at) })
      d.setDate(d.getDate() + 7)
    }
  }
  return out.sort((a, b) => a.start_at.localeCompare(b.start_at))
})
// Session-column filters: pick a weekly slot (e.g. Monday 1–2pm) + date range.
const reportFrom = ref<string>('')
const reportTo = ref<string>('')
// Pick one weekly session slot to view (null = all). One option per schedule row.
const selectedSlot = ref<string | null>(null)
const slotPickOptions = computed(() => schedules.value.map(sch => ({
  value: `${sch.day_of_week}-${(sch.start_time || '').slice(0, 5)}`,
  label: `${dayNames[sch.day_of_week]} ${formatTime(sch.start_time)} – ${formatTime(sch.end_time)}`,
})))
const visibleSessions = computed(() => reportSessions.value.filter(s => {
  if (selectedSlot.value && s.slot !== selectedSlot.value) return false
  const ymd = s.start_at.slice(0, 10)
  if (reportFrom.value && ymd < reportFrom.value) return false
  if (reportTo.value && ymd > reportTo.value) return false
  return true
}))

// Attendance matrix (Trainings tab) — `attendance` rows (person_id, event_id, attended).
const attendanceRows = ref<Array<{ person_id: string; event_id: string }>>([])
// People who attended but aren't members or staff of the group = visitors.
const visitorPeople = ref<Array<{ id: string; name: string; roles: string[] }>>([])
async function loadAttendance() {
  const ids = trainingSessions.value.map(s => s.id)
  if (!ids.length) { attendanceRows.value = []; visitorPeople.value = []; return }
  const { data } = await (db.from as any)('attendance')
    .select('person_id, event_id').in('event_id', ids).eq('attended', true)
  attendanceRows.value = data ?? []
  const onRoster = new Set([...members.value, ...coaches.value].map(p => p.id))
  const visitorIds = [...new Set(attendanceRows.value.map(r => r.person_id))].filter(pid => !onRoster.has(pid))
  if (!visitorIds.length) { visitorPeople.value = []; return }
  const { data: vp } = await (db.from as any)('persons')
    .select('id, first_name, last_name, email, phone').in('id', visitorIds)
  visitorPeople.value = (vp ?? []).map((p: any) => ({
    id: p.id, name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—', email: p.email ?? null, phone: p.phone ?? null, roles: [],
  }))
}
const attendedByPerson = computed(() => {
  const m: Record<string, Set<string>> = {}
  for (const r of attendanceRows.value) (m[r.person_id] ??= new Set()).add(r.event_id)
  return m
})
const attended = (personId: string, eventId: string | null) => !!(eventId && attendedByPerson.value[personId]?.has(eventId))
const personTotal = (personId: string) => attendedByPerson.value[personId]?.size ?? 0
const sessionTotal = (eventId: string | null) => eventId ? members.value.filter(m => attended(m.id, eventId)).length : 0
const attendedMembers = computed(() => members.value.filter(m => personTotal(m.id) > 0).slice().sort((a, b) => a.name.localeCompare(b.name)))
const nonAttendees = computed(() => members.value.filter(m => personTotal(m.id) === 0).slice().sort((a, b) => a.name.localeCompare(b.name)))
const totalAttendances = computed(() => visibleSessions.value.reduce((sum, s) => sum + sessionTotal(s.eventId), 0))
const attendanceStats = computed(() => {
  const rows = visibleSessions.value.map(s => ({ n: sessionTotal(s.eventId), at: s.start_at }))
  if (!rows.length) return null
  const high = rows.reduce((a, b) => b.n > a.n ? b : a)
  const low = rows.reduce((a, b) => b.n < a.n ? b : a)
  const avg = Math.round(rows.reduce((s, r) => s + r.n, 0) / rows.length)
  return { high, low, avg }
})
const sessDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
const sessTime = (iso: string) => {
  const d = new Date(iso); let h = d.getHours(); const m = d.getMinutes()
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`
}
const fmtDayMonth = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
// Report search + filters + export.
const reportFilterPanel = ref()
const reportFilter = reactive({ members: true, staff: true, visitors: true })
const reportSearch = ref('')
const reportSearchOpen = ref(false)
const reportSearchInput = ref<any>(null)
function toggleReportSearch() {
  reportSearch.value = ''
  reportSearchOpen.value = !reportSearchOpen.value
}
// Focus the field once it has finished transitioning in.
function onSearchEntered(el: any) {
  if (reportSearchOpen.value && el && typeof el.focus === 'function') el.focus()
}
// Extra person columns on the report (Name always shown; Roles/Phone/Email opt-in).
const reportColsPanel = ref()
const reportHiddenCols = ref<string[]>(['roles', 'phone', 'email'])
const reportPersonCols = computed(() => personColumns.value.filter(c => !reportHiddenCols.value.includes(c.key)))
function toggleReportCol(key: string) {
  reportHiddenCols.value = reportHiddenCols.value.includes(key) ? reportHiddenCols.value.filter(k => k !== key) : [...reportHiddenCols.value, key]
}
const matchName = (p: any) => !reportSearch.value.trim() || (p.name ?? '').toLowerCase().includes(reportSearch.value.trim().toLowerCase())
const byNameRep = (a: any, b: any) => a.name.localeCompare(b.name)
const filteredMembers = computed(() => members.value.filter(matchName).slice().sort(byNameRep))
// View members as a flat list or grouped by their sub-group.
const reportGrouped = ref(false)
const memberRowItems = computed<Array<{ kind: 'header' | 'person'; label?: string; color?: string; p?: any }>>(() => {
  if (!reportGrouped.value) return filteredMembers.value.map(p => ({ kind: 'person', p }))
  const items: Array<{ kind: 'header' | 'person'; label?: string; color?: string; p?: any }> = []
  for (const sg of subGroups.value) {
    const ppl = filteredMembers.value.filter(m => m.subGroupId === sg.id)
    if (!ppl.length) continue
    items.push({ kind: 'header', label: sg.name, color: sg.color })
    ppl.forEach(p => items.push({ kind: 'person', p }))
  }
  const un = filteredMembers.value.filter(m => !m.subGroupId)
  if (un.length) { items.push({ kind: 'header', label: 'Unassigned', color: '#94a3b8' }); un.forEach(p => items.push({ kind: 'person', p })) }
  return items
})
const filteredStaff = computed(() => coaches.value.filter(matchName).slice().sort(byNameRep))
const filteredVisitors = computed(() => visitorPeople.value.filter(matchName).slice().sort(byNameRep))
// When a search is active, only show sections that actually have a match.
const hasSearch = computed(() => !!reportSearch.value.trim())
// Per-section attendance totals.
const sectionTotal = (list: any[], eventId: string | null) => eventId ? list.filter(p => attended(p.id, eventId)).length : 0
const sectionGrand = (list: any[]) => visibleSessions.value.reduce((s, c) => s + sectionTotal(list, c.eventId), 0)
// Shared matrix used by all three exporters (respects filters + search).
const personCellValue = (p: any, key: string) => key === 'roles' ? (p.roles ?? []).map(roleLabel).join('; ') : (p[key] ?? '')
function reportRows() {
  const cols = visibleSessions.value
  const pcols = reportPersonCols.value
  const head = [...pcols.map(c => c.label), ...cols.map(c => `${sessDate(c.start_at)} ${sessTime(c.start_at)}`), 'Total']
  const line = (p: any) => [...pcols.map(c => personCellValue(p, c.key)), ...cols.map(c => attended(p.id, c.eventId) ? '✓' : ''), String(personTotal(p.id))]
  const rows: string[][] = []
  if (reportFilter.members) filteredAttended.value.forEach(m => rows.push(line(m)))
  if (reportFilter.nonAttendees) filteredNonAttendees.value.forEach(m => rows.push(line(m)))
  rows.push(['Total members', ...pcols.slice(1).map(() => ''), ...cols.map(c => String(sessionTotal(c.eventId))), String(totalAttendances.value)])
  if (reportFilter.staff) filteredStaff.value.forEach(c => rows.push(line(c)))
  return { head, rows }
}
const reportFileBase = () => `${(group.value?.name ?? 'group').replace(/\s+/g, '-')}-attendance`
function downloadBlob(content: BlobPart, mime: string, ext: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = `${reportFileBase()}.${ext}`; a.click()
  URL.revokeObjectURL(url)
}
function exportCsv() {
  const { head, rows } = reportRows()
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\n')
  downloadBlob('﻿' + csv, 'text/csv;charset=utf-8;', 'csv')
}
function reportTableHtml() {
  const { head, rows } = reportRows()
  const th = head.map(h => `<th style="border:1px solid #ccc;padding:4px 8px;background:#1E2157;color:#fff;font-size:11px">${h}</th>`).join('')
  const trs = rows.map(r => {
    const isTotal = r[0] === 'Total members'
    return `<tr${isTotal ? ' style="font-weight:bold;background:#f1f3f6"' : ''}>` + r.map((c, i) =>
      `<td style="border:1px solid #ccc;padding:4px 8px;font-size:11px;${i > 1 && i < r.length - 1 ? 'text-align:center;' : ''}${c === '✓' ? 'color:#16a34a;background:#f0fdf4;' : ''}">${c}</td>`).join('') + '</tr>'
  }).join('')
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
}
function exportExcel() {
  const html = `<html><head><meta charset="utf-8"></head><body><h3>${group.value?.name ?? 'Group'} — Attendance</h3>${reportTableHtml()}</body></html>`
  downloadBlob('﻿' + html, 'application/vnd.ms-excel', 'xls')
}
function exportPdf() {
  // Print via a hidden iframe (no popup blocker, no new tab) → user picks "Save as PDF".
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) { document.body.removeChild(iframe); return }
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${reportFileBase()}</title>
    <style>@page{size:landscape;margin:14mm} body{margin:0;font-family:Arial,sans-serif}</style></head>
    <body><h2 style="color:#1E2157;margin:0 0 12px">${group.value?.name ?? 'Group'} — Attendance</h2>${reportTableHtml()}</body></html>`)
  doc.close()
  const win = iframe.contentWindow!
  setTimeout(() => {
    win.focus(); win.print()
    setTimeout(() => document.body.removeChild(iframe), 1500)
  }, 300)
}
const exportMenu = ref()
const exportItems = [
  { label: 'CSV', icon: 'pi pi-file', command: () => exportCsv() },
  { label: 'Excel', icon: 'pi pi-file-excel', command: () => exportExcel() },
  { label: 'PDF', icon: 'pi pi-file-pdf', command: () => exportPdf() },
  { separator: true },
  { label: 'Print', icon: 'pi pi-print', command: () => exportPdf() },
  { label: 'Graph', icon: 'pi pi-chart-bar', command: () => { showGraph.value = true } },
]
// Attendance graph (per visible session, members + staff).
const showGraph = ref(false)
const attendanceChartData = computed(() => ({
  labels: visibleSessions.value.map(s => `${sessDate(s.start_at)} ${sessTime(s.start_at)}`),
  datasets: [
    { label: 'Members', backgroundColor: '#1E2157', borderRadius: 4, data: visibleSessions.value.map(s => sectionTotal(members.value, s.eventId)) },
    { label: 'Staff', backgroundColor: '#1976d2', borderRadius: 4, data: visibleSessions.value.map(s => sectionTotal(coaches.value, s.eventId)) },
  ],
}))
const attendanceChartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
  scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { precision: 0 } } },
}
function fmtEventWhen(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// End cell for the upcoming-events table: just the time when it ends the same
// day as it starts (the common training case), otherwise the full date + time.
function fmtEndCell(e: { start_at: string; end_at: string | null }) {
  if (!e.end_at) return '—'
  const sameDay = new Date(e.start_at).toDateString() === new Date(e.end_at).toDateString()
  return sameDay
    ? new Date(e.end_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : fmtEventWhen(e.end_at)
}

function emptyLocation(): LocationEntry {
  return { type: 'BOOKABLE', venue_name: '', address: '', meeting_link: '', bookable_ids: [] }
}

function normalizeLocation(raw: any): LocationEntry {
  const base = emptyLocation()
  if (!raw || typeof raw !== 'object') return base
  return {
    type: raw.type ?? 'BOOKABLE',
    venue_name: raw.venue_name ?? '',
    address: raw.address ?? '',
    meeting_link: raw.meeting_link ?? '',
    bookable_ids: Array.isArray(raw.bookable_ids) ? raw.bookable_ids : [],
  }
}

function formatTime(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function locationLabel(loc: LocationEntry): string {
  if (loc.type === 'ADDRESS') {
    return [loc.venue_name, loc.address].filter(Boolean).join(', ')
  }
  if (loc.type === 'ONLINE') return loc.meeting_link || 'Online'
  if (loc.type === 'BOOKABLE') {
    const names = loc.bookable_ids
      .map(id => bookableNameById.value[id])
      .filter(Boolean)
    return names.join(', ')
  }
  return ''
}

function formatSchedule(s: Schedule): string {
  const base = `${dayShort[s.day_of_week]} ${formatTime(s.start_time)} – ${formatTime(s.end_time)}`
  const label = locationLabel(s.location)
  return label ? `${base} · ${label}` : base
}

function openScheduleEditor() {
  draftSchedules.value = schedules.value.map(s => ({
    ...s,
    location: { ...s.location, bookable_ids: [...s.location.bookable_ids] },
  }))
  editorOpen.value = true
}

function openLocationPicker(index: number) {
  locationPickerIndex.value = index
  const loc = draftSchedules.value[index]?.location ?? emptyLocation()
  locationDraft.value = { ...loc, bookable_ids: [...loc.bookable_ids] }
  locationPickerOpen.value = true
}

function applyLocationPicker() {
  if (locationPickerIndex.value !== null && locationDraft.value) {
    draftSchedules.value[locationPickerIndex.value].location = locationDraft.value
  }
  locationPickerOpen.value = false
  locationPickerIndex.value = null
  locationDraft.value = null
}

function addDraftSchedule() {
  draftSchedules.value.push({
    id: `new-${Date.now()}-${Math.random()}`,
    name: '',
    day_of_week: 1,
    start_time: '15:00',
    end_time: '17:00',
    location: emptyLocation(),
    sort_order: draftSchedules.value.length,
  })
}

async function saveSchedules() {
  if (!group.value || !orgId.value) return
  savingSchedules.value = true
  const gid = group.value.id
  const draft = draftSchedules.value.filter(r => r.start_time && r.end_time)
  const existing = draft.filter(r => !r.id.startsWith('new-'))
  const fresh = draft.filter(r => r.id.startsWith('new-'))

  // Delete rows the user removed from the draft. Existing rows are
  // updated in place so that events linked via
  // member_group_schedule_id stay attached.
  const keepIds = existing.map(r => r.id)
  let delQ: any = (db.from as any)('member_group_schedules').delete().eq('group_id', gid)
  if (keepIds.length) delQ = delQ.not('id', 'in', `(${keepIds.join(',')})`)
  await delQ

  for (let i = 0; i < existing.length; i++) {
    const r = existing[i]
    await (db.from as any)('member_group_schedules').update({
      name: r.name?.trim() || null,
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
      location: r.location,
      sort_order: i,
    }).eq('id', r.id)
  }

  if (fresh.length) {
    await (db.from as any)('member_group_schedules').insert(
      fresh.map((r, i) => ({
        org_id: orgId.value,
        group_id: gid,
        name: r.name?.trim() || null,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        location: r.location,
        sort_order: existing.length + i,
      }))
    )
  }

  const { data: scheds } = await (db.from as any)('member_group_schedules')
    .select('id, name, day_of_week, start_time, end_time, location, sort_order')
    .eq('group_id', gid)
    .order('day_of_week')
    .order('start_time')
  schedules.value = (scheds ?? []).map((s: any) => ({
    ...s,
    location: normalizeLocation(s.location),
  })) as Schedule[]
  await loadEvents()
  await loadAttendance()
  savingSchedules.value = false
  editorOpen.value = false
}

async function removeMember(m: Member) {
  if (!group.value) return
  const keep = staffRolesOf(m.allRoles) // roles to retain if they're also a coach/manager
  const msg = keep.length
    ? `Remove ${m.name} as a member? They'll stay as ${keep.map(roleLabel).join(', ')}.`
    : `Remove ${m.name} from ${group.value.name}?`
  if (!window.confirm(msg)) return
  if (keep.length) {
    await (db.from as any)('member_group_memberships')
      .update({ roles: keep, role: keep[0] })
      .eq('group_id', group.value.id).eq('person_id', m.id)
  } else {
    await (db.from as any)('member_group_memberships')
      .delete().eq('group_id', group.value.id).eq('person_id', m.id)
  }
  members.value = members.value.filter(x => x.id !== m.id)
  const c = coaches.value.find(x => x.id === m.id); if (c) { c.allRoles = keep; c.roles = staffRolesOf(keep) }
}
// Single-table remove: drops the person from the group entirely (all roles).
async function removePerson(p: any) {
  if (!group.value) return
  if (!window.confirm(`Remove ${p.name} from ${group.value.name}?`)) return
  await (db.from as any)('member_group_memberships').delete().eq('group_id', group.value.id).eq('person_id', p.id)
  coaches.value = coaches.value.filter(x => x.id !== p.id)
  members.value = members.value.filter(x => x.id !== p.id)
  peopleSelection.value = peopleSelection.value.filter((x: any) => x.id !== p.id)
}

// ── Edit group details ──
const GROUP_PALETTE = ['#1976d2', '#0f766e', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#7c3aed', '#475569', '#0891b2']
const groupEditOpen = ref(false)
const savingGroup = ref(false)
const groupImageInput = ref<HTMLInputElement | null>(null)
const GENDER_RESTRICTION_OPTIONS = [
  { label: 'Open to all', value: null },
  { label: 'Male only', value: 'MALE' },
  { label: 'Female only', value: 'FEMALE' },
  { label: 'Non-binary only', value: 'NON_BINARY' },
]
const genderRestrictionLabel = (v: string | null | undefined) =>
  v ? (GENDER_RESTRICTION_OPTIONS.find(o => o.value === v)?.label ?? v) : ''
const groupDraft = reactive<{ name: string; color: string | null; code_id: string | null; age_range: string | null; capacity: number | null; gender_restriction: string | null; image_url: string | null; head_person_id: string | null }>({
  name: '', color: null, code_id: null, age_range: null, capacity: null, gender_restriction: null, image_url: null, head_person_id: null,
})
function openGroupEditor() {
  if (!group.value) return
  Object.assign(groupDraft, {
    name: group.value.name, color: group.value.color ?? null,
    code_id: group.value.code_id ?? null,
    age_range: group.value.age_range ?? null, capacity: group.value.capacity ?? null,
    gender_restriction: group.value.gender_restriction ?? null,
    image_url: group.value.image_url ?? null, head_person_id: group.value.head_person_id ?? null,
  })
  groupEditOpen.value = true
}
const uploadingGroupImage = ref(false)
async function onGroupImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  groupDraft.image_url = URL.createObjectURL(file)
  uploadingGroupImage.value = true
  try { groupDraft.image_url = await uploadFile(file) } finally { uploadingGroupImage.value = false }
}
async function saveGroup() {
  if (!group.value || !groupDraft.name.trim()) return
  savingGroup.value = true
  const patch = {
    name: groupDraft.name.trim(), color: groupDraft.color,
    code_id: groupDraft.code_id || null,
    age_range: groupDraft.age_range || null, capacity: groupDraft.capacity ?? null,
    gender_restriction: groupDraft.gender_restriction || null,
    image_url: groupDraft.image_url || null, head_person_id: groupDraft.head_person_id || null,
  }
  const { error } = await (db.from as any)('member_groups').update(patch).eq('id', group.value.id)
  savingGroup.value = false
  if (!error) { Object.assign(group.value, patch); groupEditOpen.value = false }
}

// ── Add a person to the group with one or more roles ──
const addOpen = ref(false)
const addMode = ref<'member' | 'coach'>('member')
const addRoles = ref<string[]>(['member'])
const pendingPerson = ref<any>(null)
const personQuery = ref<any>('')
const personResults = ref<any[]>([])
// Member POSITIONS (Captain, Wing…) — catalogue resolved from the group's code
// chain; new ones can be added inline (written to the group's own code).
const addPositions = ref<string[]>([])
const newAddPosition = ref('')
const showNewPosition = ref(false)
// Optional note captured while adding a person — saved as a person_note linked to
// the group/waitlist context (also surfaces on the person's profile Notes feed).
// Most people are members, so the Staff-role picker is tucked behind a disclosure
// (opened automatically when adding via the Coaches card or editing existing staff).
const showStaffRoles = ref(false)
// Resolved position catalogue = code chain + org default positions (incl. Member).
const positionOptions = computed(() =>
  (group.value ? gc.effectivePositions(group.value, codesById.value) : []).map(p => ({ label: p, value: p })))

// Capacity → waitlist warning, shown INLINE in the Add-person dialog. Fires when
// the picked person would be a NEW member, the group is full, and it has a waitlist.
const addWillBeMember = computed(() => {
  const prev = coaches.value.find(x => x.id === pendingPerson.value?.id)?.allRoles
    ?? members.value.find(x => x.id === pendingPerson.value?.id)?.allRoles ?? []
  const merged = Array.from(new Set([...prev, ...addRoles.value]))
  return addPositions.value.length > 0 || !rolesAreStaff(merged) || memberRolesOf(merged).length > 0
})
const groupFull = computed(() => !!group.value?.capacity && members.value.length >= (group.value!.capacity as number))
const addWaitlistWarn = computed(() =>
  !!pendingPerson.value?.id && addWillBeMember.value
  && !members.value.some(m => m.id === pendingPerson.value?.id)
  && groupFull.value && !!group.value?.waitlist_id)

// Equivalent groups on the same waitlist — with their spare capacity — so a full
// Thursday can offer "put them in Friday instead". Loaded when the dialog opens.
const waitlistSiblings = ref<{ id: string; name: string; capacity: number | null; count: number }[]>([])
const siblingsWithSpace = computed(() => waitlistSiblings.value.filter(s => s.capacity == null || s.count < s.capacity))
async function loadWaitlistSiblings() {
  waitlistSiblings.value = []
  const wid = group.value?.waitlist_id
  if (!wid) return
  const { data: sibs } = await (db.from as any)('member_groups')
    .select('id, name, capacity').eq('waitlist_id', wid).neq('id', group.value!.id)
  if (!sibs?.length) return
  const ids = sibs.map((s: any) => s.id)
  const { data: mems } = await (db.from as any)('member_group_memberships').select('group_id, role, roles').in('group_id', ids)
  const counts: Record<string, number> = {}
  for (const m of mems ?? []) {
    const roleKeys = scoped.normalizeRoles('group', m.roles, m.role)
    if (!scoped.isStaff('group', roleKeys)) counts[m.group_id] = (counts[m.group_id] ?? 0) + 1
  }
  waitlistSiblings.value = sibs.map((s: any) => ({ id: s.id, name: s.name, capacity: s.capacity ?? null, count: counts[s.id] ?? 0 }))
}

// Add the picked person to the connected waitlist instead of the group.
async function addToWaitlist() {
  const p = pendingPerson.value
  if (!p?.id || !group.value?.waitlist_id) return
  const wlName = groupWaitlist.value?.name || 'the waitlist'
  const r = await wl.addEntry(group.value.waitlist_id, p.id, groupWaitlist.value?.count ?? 0)
  toast.add(r.ok
    ? { severity: 'success', summary: `Added to waitlist "${wlName}"`, life: 2500 }
    : { severity: 'warn', summary: 'Already on this waitlist', life: 2500 })
  pendingPerson.value = null; personQuery.value = ''; personResults.value = []; addOpen.value = false
  if (r.ok) navigateTo('/groups/waitlists')
}
// Add the picked person to an EQUIVALENT group (same waitlist) that has space.
async function addToSiblingGroup(s: { id: string; name: string }) {
  const p = pendingPerson.value
  if (!p?.id) return
  const positions = [...addPositions.value]
  const { error } = await (db.from as any)('member_group_memberships')
    .upsert({ group_id: s.id, person_id: p.id, roles: [], role: null, positions }, { onConflict: 'group_id,person_id' })
  toast.add(error
    ? { severity: 'error', summary: 'Could not add', detail: error.message, life: 4000 }
    : { severity: 'success', summary: `Added to ${s.name}`, life: 2500 })
  if (!error) { pendingPerson.value = null; personQuery.value = ''; personResults.value = []; addOpen.value = false }
}
async function addNewPosition() {
  const n = newAddPosition.value.trim()
  newAddPosition.value = ''
  if (!n || !group.value?.code_id) return
  // Case-insensitive: reuse an existing option, else append it to the group's code.
  const existing = positionOptions.value.find(o => o.value.toLowerCase() === n.toLowerCase())
  const value = existing?.value ?? n
  if (!existing) {
    const next = await gc.addPositionToCode(group.value.code_id, n, codesById.value)
    if (next) { const c = codesById.value[group.value.code_id]; if (c) c.member_positions = next }
  }
  if (!addPositions.value.some(p => p.toLowerCase() === value.toLowerCase())) addPositions.value.push(value)
}
function openAdd(mode: 'member' | 'coach', person?: any) {
  addMode.value = mode
  // Seed sensible default roles depending on which card's Add was clicked. For
  // staff, prefer the code's "Coach" role, else its first configured staff role.
  const coachSeed = codeStaffRoles.value.some(r => r.key === 'coach') ? 'coach' : codeStaffRoles.value[0]?.key
  // One unified screen: Staff roles + Positions are both optional. Editing an
  // existing person seeds their current staff roles + positions; a fresh add from
  // the Coaches card conveniently pre-picks the default staff role.
  addRoles.value = person?.id ? staffRolesOf(person.allRoles ?? person.roles ?? [])
    : (mode === 'coach' && coachSeed ? [coachSeed] : [])
  addPositions.value = Array.isArray(person?.positions) ? [...person.positions] : []
  // Reveal the staff-role picker only when relevant (coach card / existing staff).
  showStaffRoles.value = mode === 'coach' || addRoles.value.length > 0
  newAddPosition.value = ''
  showNewPosition.value = false
  addEnrol.value = null
  if (person?.id) {
    // Clicking an existing person's name → pre-select them in the picker.
    const name = person.name || `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
    const picked = { id: person.id, name, first_name: person.first_name, last_name: person.last_name, email: person.email, phone: person.phone, label: name }
    personQuery.value = picked
    pendingPerson.value = picked
  } else {
    pendingPerson.value = null
    personQuery.value = ''
  }
  personResults.value = []
  addOpen.value = true
  loadWaitlistSiblings()
}
async function searchPersons(e: { query: string }) {
  const q = (e.query || '').trim()
  // Existing members CAN be picked again — adding a role merges into their
  // membership (e.g. give a coach the Player role so they're both).
  let query = (db.from as any)('persons')
    .select('id, first_name, last_name, email, phone, gender')
    .eq('org_id', orgId.value).order('last_name').limit(25)
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  const { data } = await query
  personResults.value = (data ?? [])
    .map((p: any) => {
      const inGroup = members.value.some(m => m.id === p.id) || coaches.value.some(c => c.id === p.id)
      return { ...p, label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() + (inGroup ? ' · in group' : '') }
    })
}
function onPickPerson(e: { value: any }) { pendingPerson.value = e.value }
async function addPerson() {
  const p = pendingPerson.value
  // Staff roles + positions are both optional — a person can be staff, a member,
  // or both. Only a picked person is required.
  if (!p?.id || !group.value) return
  // Merge with any roles they already hold so adding a role to an existing
  // member keeps the others (coach picking up Player → both, not replaced).
  const prev = coaches.value.find(x => x.id === p.id)?.allRoles
    ?? members.value.find(x => x.id === p.id)?.allRoles ?? []
  const merged = Array.from(new Set([...prev, ...addRoles.value]))
  const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.name || 'This person'
  // Gender restriction — only when they're joining AS A MEMBER (staff are exempt).
  const restrict = group.value.gender_restriction
  if (restrict && memberRolesOf(merged).length && p.gender && p.gender !== 'UNSPECIFIED' && p.gender !== restrict) {
    if (!window.confirm(`${name}'s gender doesn't match this group's restriction (${genderRestrictionLabel(restrict)}). Add them anyway?`)) return
  }
  const enrol = enrolPatch()
  // Union with any positions they already hold (like roles, this dialog adds —
  // positions are removed via the person's own edit, not by re-adding).
  const prevPositions = coaches.value.find(x => x.id === p.id)?.positions
    ?? members.value.find(x => x.id === p.id)?.positions ?? []
  const positions = Array.from(new Set([...prevPositions, ...addPositions.value]))
  const { error } = await (db.from as any)('member_group_memberships')
    .upsert({ group_id: group.value.id, person_id: p.id, roles: merged, role: merged[0] ?? null, positions, ...(enrol ?? {}) },
      { onConflict: 'group_id,person_id' })
  if (!error) {
    // Stamp the code's member type on the person (joining as a member) so they
    // pick up that type's custom fields.
    if (groupMemberType.value && (!merged.length || memberRolesOf(merged).length)) {
      await ensurePersonType(p.id, groupMemberType.value)
    }
    const base = { id: p.id, name, email: p.email ?? null, phone: p.phone ?? null, allRoles: merged, positions }
    // Rebuild this person's presence across both tables from the merged roles.
    coaches.value = coaches.value.filter(x => x.id !== p.id)
    members.value = members.value.filter(x => x.id !== p.id)
    if (rolesAreStaff(merged)) {
      coaches.value.push({ ...base, roles: staffRolesOf(merged) })
      coaches.value.sort((a, b) => a.name.localeCompare(b.name))
    }
    // Member if they hold a position, a non-staff role, or aren't staff at all.
    if (positions.length || !rolesAreStaff(merged) || memberRolesOf(merged).length) {
      members.value.push({ ...base, roles: memberRolesOf(merged) })
      members.value.sort((a, b) => a.name.localeCompare(b.name))
    }
  }
  pendingPerson.value = null
  personQuery.value = ''
  personResults.value = []
  addOpen.value = false
}
async function removeCoach(c: Coach) {
  if (!group.value) return
  const keep = memberRolesOf(c.allRoles) // roles to retain if they're also a member/player
  const msg = keep.length
    ? `Remove ${c.name} as a coach/manager? They'll stay as ${keep.map(roleLabel).join(', ') || 'a member'}.`
    : `Remove ${c.name} as a coach of ${group.value.name}?`
  if (!window.confirm(msg)) return
  if (keep.length) {
    await (db.from as any)('member_group_memberships')
      .update({ roles: keep, role: keep[0] ?? null })
      .eq('group_id', group.value.id).eq('person_id', c.id)
  } else {
    await (db.from as any)('member_group_memberships')
      .delete().eq('group_id', group.value.id).eq('person_id', c.id)
  }
  coaches.value = coaches.value.filter(x => x.id !== c.id)
  const m = members.value.find(x => x.id === c.id); if (m) { m.allRoles = keep; m.roles = memberRolesOf(keep) }
}

async function createAttendanceEvent() {
  if (!group.value || !orgId.value) return
  if (createBlockedReason.value) return
  const season = effectiveSeason()
  creatingEvent.value = true
  try {
    const { expandRrule, dateKey } = await import('~/composables/useRecurrence')
    // Re-fetch existing event links right before iterating so a stale
    // local cache (e.g. a previous click that already created events
    // but the watcher hasn't repainted) can't double-create.
    await loadEvents()
    const toCreate = schedules.value.filter(s => !trainingEventByScheduleId.value[s.id])

    const untilStr = `${season.end.replace(/-/g, '')}T235959Z`
    const [ey, em, ed] = season.end.split('-').map(Number)
    const seasonEndDate = new Date(ey, (em ?? 1) - 1, ed ?? 1, 23, 59, 59)
    const byDayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

    for (const sched of toCreate) {
      const firstDate = findFirstOccurrence(sched.day_of_week, season.start)
      if (!firstDate || firstDate > seasonEndDate) continue

      const [sh, smin] = sched.start_time.split(':').map(Number)
      const [eh, emin] = sched.end_time.split(':').map(Number)
      const masterStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), sh ?? 0, smin ?? 0)
      const masterEnd = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), eh ?? 0, emin ?? 0)
      const duration = masterEnd.getTime() - masterStart.getTime()

      const rrule = `FREQ=WEEKLY;BYDAY=${byDayCodes[sched.day_of_week]};UNTIL=${untilStr}`
      const dayName = dayNames[sched.day_of_week]

      const sharedFields = {
        org_id: orgId.value,
        title: sched.name?.trim() ? `${group.value.name} — ${sched.name.trim()}` : `${group.value.name} — ${dayName} Training`,
        style: 'BASIC',
        member_group_id: group.value.id,
        member_group_schedule_id: sched.id,
        location_type: sched.location.type,
        bookable_id: sched.location.type === 'BOOKABLE' ? (sched.location.bookable_ids[0] ?? null) : null,
        address: sched.location.type === 'ADDRESS'
          ? [sched.location.venue_name, sched.location.address].filter(Boolean).join(', ') || null
          : null,
        meeting_link: sched.location.type === 'ONLINE' ? (sched.location.meeting_link || null) : null,
        status: 'DRAFT',
      }

      const { data: master } = await (db.from as any)('events').insert({
        ...sharedFields,
        start_at: masterStart.toISOString(),
        end_at: masterEnd.toISOString(),
        recurrence_rule: rrule,
      }).select('id').single()
      if (!master) continue

      // Materialize child events (one per subsequent weekly occurrence
      // inside the season). The master itself already represents the
      // first occurrence so we skip its dateKey.
      const occurrences = expandRrule(rrule, masterStart, seasonEndDate, 200)
      const masterKey = dateKey(masterStart)
      // Children inherit member_group_id (so reporting + the attendance
      // landing still find them) but the schedule-id pointer stays on
      // the master alone — that keeps the "1 schedule = 1 master" model
      // clean.
      const { member_group_schedule_id: _omit, ...childShared } = sharedFields
      const childRows = occurrences
        .filter(d => dateKey(d) !== masterKey)
        .map(d => {
          const childStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh ?? 0, smin ?? 0)
          const childEnd = new Date(childStart.getTime() + duration)
          return {
            ...childShared,
            recurrence_parent_id: master.id,
            recurrence_rule: null,
            start_at: childStart.toISOString(),
            end_at: childEnd.toISOString(),
          }
        })
      const eventIds: string[] = [master.id]
      if (childRows.length) {
        const { data: insertedChildren } = await (db.from as any)('events').insert(childRows).select('id')
        for (const c of insertedChildren ?? []) eventIds.push(c.id)
      }

      // Invite every group member to every event in the series, so the
      // attendance tab on each occurrence is preloaded with the roster.
      const memberPersonIds = members.value.map(m => m.id)
      if (memberPersonIds.length && eventIds.length) {
        const inviteeRows: any[] = []
        for (const eid of eventIds) {
          for (const pid of memberPersonIds) {
            inviteeRows.push({ event_id: eid, person_id: pid, status: 'INVITED' })
          }
        }
        await (db.from as any)('invitees').insert(inviteeRows)
      }
    }

    await loadEvents()
    await loadAttendance()
  } finally {
    creatingEvent.value = false
  }
}

function findFirstOccurrence(dow: number, startIso?: string | null): Date | null {
  const start = startIso || seasonStart.value
  if (!start) return null
  const [sy, sm, sd] = start.split('-').map(Number)
  const d = new Date(sy, (sm ?? 1) - 1, sd ?? 1)
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1)
  return d
}

watch(orgId, () => { load(); scoped.load(); scoped.loadRoleDefs(); gc.loadDefaultPositions() }, { immediate: true })
watch(() => route.params.id, () => { if (orgId.value) load() })
</script>
