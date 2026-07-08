<template>
  <div class="p-3 sm:p-6">
    <!-- Title lives in the control bar (useBreadcrumbs). -->
    <!-- Mobile: on-page switcher (desktop switches from the People nav flyout) -->
    <div class="md:hidden inline-flex rounded-lg border border-gray-200 p-0.5 mb-4">
      <button v-for="v in (['people','admins','organisations'] as const)" :key="v" type="button"
        class="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
        :class="view === v ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:text-gray-800'"
        @click="view = v">{{ { people: 'People', admins: 'Admins', organisations: 'Organisations' }[v] }}</button>
    </div>

    <template v-if="view === 'people'">
    <!-- Governing orgs: own people vs members pulled up from the clubs beneath -->
    <div v-if="isGoverning" class="flex items-center gap-1 mb-4 border-b border-gray-200">
      <button type="button" class="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="peopleScope === 'own' ? 'border-[#1E2157] text-[#1E2157]' : 'border-transparent text-gray-500 hover:text-gray-800'"
        @click="peopleScope = 'own'">Our people</button>
      <button type="button" class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="peopleScope === 'club' ? 'border-[#1E2157] text-[#1E2157]' : 'border-transparent text-gray-500 hover:text-gray-800'"
        @click="peopleScope = 'club'">
        Club members
        <span class="text-xs px-1.5 rounded-full" :class="peopleScope === 'club' ? 'bg-[#1E2157]/10 text-[#1E2157]' : 'bg-gray-100 text-gray-400'">{{ clubMembers.length }}</span>
      </button>
    </div>
    <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <IconField iconPosition="left">
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search people…" size="small" class="w-full sm:w-64" />
      </IconField>
      <div v-if="peopleScope === 'own'" class="flex items-center gap-2 flex-wrap">
        <!-- Per-tab column chooser (desktop table) -->
        <div ref="colMenuWrap" class="relative hidden md:block">
          <Button label="Columns" icon="pi pi-sliders-h" size="small" severity="secondary" outlined @click="colMenuOpen = !colMenuOpen" />
          <div v-if="colMenuOpen" class="absolute right-0 top-full mt-1.5 w-60 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-1">
            <div class="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">Columns · {{ activeTabLabel }}</div>
            <label class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-400 cursor-not-allowed">
              <Checkbox :modelValue="true" :binary="true" disabled /><span>Name</span>
            </label>
            <label v-for="c in availableCols" :key="c.key" class="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-sm">
              <Checkbox :modelValue="visibleColSet.has(c.key)" :binary="true" @update:modelValue="v => toggleCol(c.key, v)" />
              <span class="text-gray-700">{{ c.label }}</span>
            </label>
            <p v-if="!availableCols.length" class="px-3 py-2 text-xs text-gray-400">No columns available.</p>
          </div>
        </div>
        <Button label="Export" icon="pi pi-download" size="small" severity="secondary" outlined @click="exportMenu.toggle($event)" />
        <Menu ref="exportMenu" :model="exportItems" popup />
        <Button label="Add person" icon="pi pi-plus" size="small"
          style="background:#1E2157;border-color:#1E2157" @click="openCreate" />
      </div>
    </div>

    <!-- Type filter: dropdown on mobile, tab strip on desktop -->
    <div v-show="peopleScope === 'own'" class="md:hidden mb-4">
      <Select v-model="activeType" :options="typeTabs" option-label="label" option-value="key" class="w-full">
        <template #option="{ option }">
          <span class="flex-1">{{ option.label }}</span>
          <span class="ml-auto text-xs text-gray-400">{{ typeCounts[option.key] ?? 0 }}</span>
        </template>
      </Select>
    </div>
    <div v-show="peopleScope === 'own'" class="hidden md:flex items-center gap-1 mb-4 border-b border-gray-200 overflow-x-auto overflow-y-hidden no-scrollbar">
      <button v-for="t in typeTabs" :key="t.key" type="button"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
        :class="activeType === t.key ? 'border-[#1E2157] text-[#1E2157]' : 'border-transparent text-gray-500 hover:text-gray-800'"
        @click="activeType = t.key">
        {{ t.label }}
        <span class="text-xs px-1.5 rounded-full" :class="activeType === t.key ? 'bg-[#1E2157]/10 text-[#1E2157]' : 'bg-gray-100 text-gray-400'">{{ typeCounts[t.key] ?? 0 }}</span>
      </button>
    </div>

    <!-- Bulk actions -->
    <div v-if="selected.length && peopleScope === 'own'" class="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-[#1E2157]/5 border border-[#1E2157]/15 flex-wrap">
      <span class="text-sm font-medium text-[#1E2157]">{{ selected.length }} selected</span>
      <span class="text-gray-300 hidden sm:inline">·</span>
      <span class="text-sm text-gray-500">Set type</span>
      <Select v-model="bulkType" :options="personTypes" optionLabel="label" optionValue="key"
        placeholder="Choose…" class="w-44" showClear size="small" />
      <Button label="Apply" size="small" :disabled="!bulkType"
        style="background:#1E2157;border-color:#1E2157" @click="bulkSetType(bulkType)" />
      <button class="text-xs text-gray-500 hover:text-gray-800" @click="bulkSetType(null)">Clear type</button>
      <span class="text-gray-300 hidden sm:inline">·</span>
      <button class="text-xs text-red-500 hover:text-red-700" @click="bulkDelete">Delete</button>
      <button class="text-xs text-gray-400 hover:text-gray-700 ml-auto" @click="selected = []">Deselect all</button>
    </div>

    <!-- Mobile: card list (table is desktop-only) -->
    <div v-show="peopleScope === 'own'" class="md:hidden">
      <div v-if="loading" class="card p-6 text-center text-surface-400"><i class="pi pi-spin pi-spinner text-xl" /></div>
      <div v-else-if="!filtered.length" class="card p-10 text-center text-surface-400">
        <i class="pi pi-users text-3xl mb-3 block" />
        <p v-if="search">No people match “{{ search }}”.</p>
        <p v-else>No people yet.</p>
      </div>
      <div v-else class="space-y-2">
        <div v-for="p in filtered" :key="p.id"
          class="card p-3 flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors"
          @click="openPerson(p)">
          <span class="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold text-white shrink-0 overflow-hidden"
            :style="p.photo_url ? {} : { background: avatarColor(p.id) }">
            <img v-if="p.photo_url" :src="p.photo_url" class="w-full h-full object-cover" />
            <span v-else>{{ initials(p) }}</span>
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-surface-800 truncate">{{ p.first_name }} {{ p.last_name }}</p>
            <p class="text-xs text-surface-500 truncate">{{ p.email || p.phone || '—' }}</p>
            <div v-if="typeKeysOf(p).length || p.membership_type || p.dob" class="flex items-center gap-1.5 mt-1 flex-wrap">
              <Tag v-for="k in typeKeysOf(p)" :key="k" :value="typeLabel(k)" />
              <Tag v-if="p.membership_type" :value="p.membership_type" severity="secondary" />
              <span v-if="p.dob" class="text-[11px] text-surface-400">{{ age(p.dob) }} yrs</span>
            </div>
          </div>
          <button type="button" class="w-9 h-9 flex items-center justify-center text-surface-400 shrink-0" @click.stop="openMenu($event, p)">
            <i class="pi pi-ellipsis-v" />
          </button>
        </div>
      </div>
    </div>

    <div v-show="peopleScope === 'own'" class="card overflow-x-auto hidden md:block">
      <DataTable :value="filtered" :loading="loading" row-hover striped-rows size="small"
        v-model:selection="selected" dataKey="id"
        paginator :rows="25" :rowsPerPageOptions="[25, 50, 100]"
        sortField="last_name" :sortOrder="1"
        @row-click="e => openPerson(e.data)" class="cursor-pointer">
        <template #empty>
          <div class="text-center py-12 text-surface-400">
            <i class="pi pi-users text-3xl mb-3 block" />
            <p v-if="search">No people match “{{ search }}”.</p>
            <p v-else>No people yet. Add your first person to get started.</p>
          </div>
        </template>

        <Column selectionMode="multiple" headerStyle="width:3rem" :exportable="false" />
        <Column field="last_name" header="Name" sortable>
          <template #body="{ data }">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold text-white shrink-0 overflow-hidden"
                :style="data.photo_url ? {} : { background: avatarColor(data.id) }">
                <img v-if="data.photo_url" :src="data.photo_url" class="w-full h-full object-cover" />
                <span v-else>{{ initials(data) }}</span>
              </span>
              <span class="font-medium text-surface-800">{{ data.first_name }} {{ data.last_name }}</span>
            </div>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('email')" field="email" header="Email" sortable>
          <template #body="{ data }">
            <span class="text-surface-600">{{ data.email || '—' }}</span>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('phone')" field="phone" header="Phone">
          <template #body="{ data }">
            <span class="text-surface-600">{{ data.phone || '—' }}</span>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('roles')" header="Roles" style="width:180px">
          <template #body="{ data }">
            <div v-if="typeKeysOf(data).length" class="flex flex-wrap gap-1">
              <Tag v-for="k in typeKeysOf(data)" :key="k" :value="typeLabel(k)" />
            </div>
            <span v-else class="text-surface-400">—</span>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('membership')" field="membership_type" header="Membership" sortable style="width:160px">
          <template #body="{ data }">
            <Tag v-if="data.membership_type" :value="data.membership_type" severity="secondary" />
            <span v-else class="text-surface-400">—</span>
          </template>
        </Column>
        <Column v-if="visibleColSet.has('age')" header="Age" style="width:80px">
          <template #body="{ data }">
            <span class="text-surface-600">{{ age(data.dob) }}</span>
          </template>
        </Column>
        <!-- Per-tab custom-field columns -->
        <Column v-for="c in customColDefs" :key="c.key" :header="c.label" style="min-width:120px">
          <template #body="{ data }">
            <span class="text-surface-600">{{ cfDisplay(data, c) }}</span>
          </template>
        </Column>
        <Column style="width:56px">
          <template #body="{ data }">
            <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small"
              @click.stop="openMenu($event, data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Club members — people pulled up from the clubs beneath this org -->
    <div v-if="peopleScope === 'club'">
      <div class="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <p class="text-sm text-gray-500 max-w-xl">People pulled into this organisation's groups from the clubs beneath it. Each is owned by their club — their profile is edited at the club.</p>
        <div class="flex items-center gap-2 text-xs shrink-0">
          <span class="text-gray-400" v-tooltip.left="'How a club member is stored when added to one of your groups'">Pull in as:</span>
          <div class="inline-flex rounded-lg border border-gray-200 p-0.5">
            <button type="button" class="px-2.5 py-1 rounded-md font-medium transition-colors" :class="pullMode === 'reference' ? 'bg-[#1E2157] text-white' : 'text-gray-500'" @click="setPullMode('reference')">Reference</button>
            <button type="button" class="px-2.5 py-1 rounded-md font-medium transition-colors" :class="pullMode === 'copy' ? 'bg-[#1E2157] text-white' : 'text-gray-500'" @click="setPullMode('copy')">Copy</button>
          </div>
        </div>
      </div>
      <div class="card overflow-x-auto">
        <table class="w-full text-sm min-w-[560px]">
          <thead>
            <tr class="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th class="text-left font-medium px-4 py-2">Name</th>
              <th class="text-left font-medium px-4 py-2">Club</th>
              <th class="text-left font-medium px-4 py-2">Email</th>
              <th class="text-left font-medium px-4 py-2">Phone</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="clubLoading"><td colspan="4" class="px-4 py-6 text-gray-400">Loading…</td></tr>
            <tr v-else-if="!clubMembersFiltered.length"><td colspan="4" class="px-4 py-10 text-center text-gray-400">No club members pulled in yet. Add people from clubs when building a group.</td></tr>
            <tr v-for="p in clubMembersFiltered" :key="p.id" class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-4 py-2.5 font-medium text-gray-800">{{ p.first_name }} {{ p.last_name }}</td>
              <td class="px-4 py-2.5">
                <span class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100"><i class="pi pi-building text-[10px]" />{{ p.club_name }}</span>
              </td>
              <td class="px-4 py-2.5 text-gray-600">{{ p.email || '—' }}</td>
              <td class="px-4 py-2.5 text-gray-600">{{ p.phone || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Menu ref="rowMenu" :model="menuItems" :popup="true" />

    <!-- Add Person Dialog -->
    <Dialog v-model:visible="showCreate" header="Add person" modal :style="{ width: '95vw', maxWidth: '420px' }">
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">First name</label>
            <InputText v-model="newPerson.first_name" autofocus @keyup.enter="handleCreate" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Last name</label>
            <InputText v-model="newPerson.last_name" @keyup.enter="handleCreate" />
          </div>
        </div>
        <div v-if="personTypes.length" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Type</label>
          <Select v-model="newPerson.person_type" :options="personTypes" optionLabel="label" optionValue="key"
            placeholder="Select a type" class="w-full" />
        </div>
        <p class="text-xs text-gray-400">You'll go straight to their profile to fill in the rest.</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create & open profile" :loading="creating"
          :disabled="!newPerson.first_name.trim() || !newPerson.last_name.trim() || !newPerson.person_type"
          style="background:#1E2157;border-color:#1E2157" @click="handleCreate" />
      </template>
    </Dialog>
    </template>

    <!-- ADMINS view — people who hold an access-granting type (or a permission group) -->
    <template v-else-if="view === 'admins'">
      <div class="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <IconField iconPosition="left">
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" placeholder="Search admins…" size="small" class="w-full sm:w-64" />
        </IconField>
        <Button label="Add admin" icon="pi pi-plus" size="small" :disabled="!adminTypeOptions.length"
          style="background:#1E2157;border-color:#1E2157" @click="openAddAdmin" />
      </div>
      <p class="text-sm text-gray-500 mb-3 max-w-2xl">People who can manage parts of the club — anyone holding an access-granting type (or a permission group). Give someone access on their <span class="text-gray-700">Profile → Roles</span>, or define access types in <NuxtLink to="/settings/fields" class="text-primary hover:underline">Types &amp; fields</NuxtLink>.</p>

      <!-- Access-type filter: dropdown on mobile, tab strip on desktop -->
      <div class="md:hidden mb-4">
        <Select v-model="adminActiveType" :options="adminTypeTabs" option-label="label" option-value="key" class="w-full">
          <template #option="{ option }">
            <span class="flex-1">{{ option.label }}</span>
            <span class="ml-auto text-xs text-gray-400">{{ adminTypeCounts[option.key] ?? 0 }}</span>
          </template>
        </Select>
      </div>
      <div class="hidden md:flex items-center gap-1 mb-4 border-b border-gray-200 overflow-x-auto overflow-y-hidden no-scrollbar">
        <button v-for="t in adminTypeTabs" :key="t.key" type="button"
          class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
          :class="adminActiveType === t.key ? 'border-[#1E2157] text-[#1E2157]' : 'border-transparent text-gray-500 hover:text-gray-800'"
          @click="adminActiveType = t.key">
          {{ t.label }}
          <span class="text-xs px-1.5 rounded-full" :class="adminActiveType === t.key ? 'bg-[#1E2157]/10 text-[#1E2157]' : 'bg-gray-100 text-gray-400'">{{ adminTypeCounts[t.key] ?? 0 }}</span>
        </button>
      </div>

      <!-- Mobile: card list -->
      <div class="md:hidden">
        <div v-if="!admins.length" class="card p-10 text-center text-surface-400"><i class="pi pi-shield text-3xl mb-3 block" /><p>No admins yet.</p></div>
        <div v-else class="space-y-2">
          <div v-for="p in admins" :key="p.id" class="card p-3 flex items-center gap-3 cursor-pointer active:bg-gray-50" @click="openPerson(p)">
            <span class="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold text-white shrink-0 overflow-hidden" :style="p.photo_url ? {} : { background: avatarColor(p.id) }">
              <img v-if="p.photo_url" :src="p.photo_url" class="w-full h-full object-cover" /><span v-else>{{ initials(p) }}</span>
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-surface-800 truncate">{{ p.first_name }} {{ p.last_name }}</p>
              <p class="text-xs text-surface-500 truncate">{{ p.email || p.phone || '—' }}</p>
              <div class="flex flex-wrap gap-1 mt-1">
                <Tag v-for="k in adminTypeKeys(p)" :key="k" :value="typeLabel(k)" />
                <Tag v-if="!adminTypeKeys(p).length" value="Permission group" severity="secondary" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop: DataTable -->
      <div class="card overflow-x-auto hidden md:block">
        <DataTable :value="admins" row-hover striped-rows size="small" dataKey="id"
          paginator :rows="25" :rowsPerPageOptions="[25, 50, 100]" sortField="last_name" :sortOrder="1"
          @row-click="e => openPerson(e.data)" class="cursor-pointer">
          <template #empty><div class="text-center py-12 text-surface-400"><i class="pi pi-shield text-3xl mb-3 block" /><p>No admins yet. Give someone an access-granting type.</p></div></template>
          <Column field="last_name" header="Name" sortable>
            <template #body="{ data }">
              <div class="flex items-center gap-3">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold text-white shrink-0 overflow-hidden" :style="data.photo_url ? {} : { background: avatarColor(data.id) }">
                  <img v-if="data.photo_url" :src="data.photo_url" class="w-full h-full object-cover" /><span v-else>{{ initials(data) }}</span>
                </span>
                <span class="font-medium text-surface-800">{{ data.first_name }} {{ data.last_name }}</span>
              </div>
            </template>
          </Column>
          <Column header="Access" style="width:220px">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-1">
                <Tag v-for="k in adminTypeKeys(data)" :key="k" :value="typeLabel(k)" />
                <Tag v-if="!adminTypeKeys(data).length" value="Permission group" severity="secondary" />
              </div>
            </template>
          </Column>
          <Column field="email" header="Email" sortable><template #body="{ data }"><span class="text-surface-600">{{ data.email || '—' }}</span></template></Column>
          <Column field="phone" header="Phone"><template #body="{ data }"><span class="text-surface-600">{{ data.phone || '—' }}</span></template></Column>
        </DataTable>
      </div>
    </template>

    <!-- ORGANISATIONS view (entity records) -->
    <template v-else>
      <div class="flex items-center justify-between gap-3 mb-4">
        <p class="text-sm text-gray-500">Teams, businesses, schools and families your club tracks.</p>
        <Button label="New" icon="pi pi-plus" size="small" :disabled="!entityTypes.length"
          style="background:#1E2157;border-color:#1E2157" @click="openNewEntity" />
      </div>

      <div v-if="entityTypes.length" class="flex gap-1 overflow-x-auto no-scrollbar border-b border-gray-200 mb-4">
        <button type="button" class="px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors"
          :class="!activeEntityType ? 'border-[#1E2157] text-[#1E2157]' : 'border-transparent text-gray-500 hover:text-gray-700'"
          @click="activeEntityType = null">All</button>
        <button v-for="t in entityTypes" :key="t.key" type="button"
          class="px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors"
          :class="activeEntityType === t.key ? 'border-[#1E2157] text-[#1E2157]' : 'border-transparent text-gray-500 hover:text-gray-700'"
          @click="activeEntityType = t.key">{{ t.label }}</button>
      </div>

      <div v-if="!entityTypes.length && !entLoading" class="card p-8 text-center text-sm text-gray-500">
        No entity types defined yet. <NuxtLink to="/settings/fields" class="text-[#1E2157] hover:underline">Create one in Settings → Types &amp; fields (Entities) →</NuxtLink>
      </div>
      <div v-else-if="entLoading" class="text-sm text-gray-400">Loading…</div>
      <div v-else-if="!entityRows.length" class="card p-8 text-center text-sm text-gray-400">No organisations yet. Create one to get started.</div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <NuxtLink v-for="r in entityRows" :key="r.id" :to="`/organisations/${r.id}`" class="card p-4 hover:shadow-md transition-shadow block">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-gray-900 truncate">{{ r.name }}</p>
              <p class="text-[11px] uppercase tracking-wide text-violet-500 mt-0.5">{{ entityTypeLabel(r.type_key) }}</p>
            </div>
            <i class="pi pi-building text-gray-300" />
          </div>
          <p class="text-xs text-gray-500 mt-3"><i class="pi pi-users text-[10px] mr-1" />{{ entityCounts[r.id] || 0 }} attached</p>
        </NuxtLink>
      </div>

      <Dialog v-model:visible="showNewEntity" modal header="New organisation" :style="{ width: '95vw', maxWidth: '420px' }">
        <div class="space-y-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Type</label>
            <Select v-model="newEntityType" :options="entityTypes" optionLabel="label" optionValue="key" class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Name</label>
            <InputText v-model="newEntityName" placeholder="e.g. U12 Tigers" class="w-full" autofocus @keyup.enter="createEntityRow" />
          </div>
        </div>
        <template #footer>
          <Button label="Cancel" text size="small" @click="showNewEntity = false" />
          <Button label="Create" size="small" :disabled="!newEntityName.trim() || !newEntityType" @click="createEntityRow" style="background:#1E2157;border-color:#1E2157" />
        </template>
      </Dialog>
    </template>

    <!-- Add admin: give an existing person an access-granting type -->
    <Dialog v-model:visible="addAdminOpen" header="Add admin" modal :style="{ width: '95vw', maxWidth: '440px' }">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Person</label>
            <button type="button" class="text-xs text-primary hover:underline" @click="adminNewMode = !adminNewMode">
              {{ adminNewMode ? 'Search existing' : '+ New person' }}
            </button>
          </div>
          <Select v-if="!adminNewMode" v-model="addAdminPersonId" :options="personPickOptions" option-label="label" option-value="value"
            filter placeholder="Search a person…" class="w-full" />
          <div v-else class="grid grid-cols-2 gap-2">
            <InputText v-model="newAdmin.first_name" placeholder="First name" autofocus />
            <InputText v-model="newAdmin.last_name" placeholder="Last name" />
            <InputText v-model="newAdmin.email" type="email" placeholder="Email (optional)" class="col-span-2" />
            <InputText v-model="newAdmin.phone" placeholder="Phone (optional)" class="col-span-2" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Access type</label>
          <Select v-model="addAdminTypeKey" :options="adminTypeOptions" option-label="label" option-value="value"
            placeholder="Choose an access type" class="w-full" />
          <p class="text-xs text-gray-400">Access types come from <NuxtLink to="/settings/fields" class="text-primary hover:underline">Types &amp; fields</NuxtLink> (types that grant access). This is added to the person's roles.</p>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text size="small" @click="addAdminOpen = false" />
        <Button :label="adminNewMode ? 'Create admin' : 'Add admin'" size="small" :loading="savingAdmin" :disabled="!canSaveAdmin"
          style="background:#1E2157;border-color:#1E2157" @click="saveAddAdmin" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const { orgId } = useOrg()
const db = useDb()
const toast = useToast()
useBreadcrumbs([{ label: 'People and organisations' }])
const { resolvePersonTypes, resolveFields, fieldAppliesTo, loadOrgTypes } = useOrgFieldPolicy()
const { loadEntities, memberCounts, createEntity } = useEntities()
const route = useRoute()

const people = ref<any[]>([])
const personTypes = ref<any[]>([])
const customFields = ref<any[]>([])
const activeType = ref('all')

// ── Cross-club members (governing orgs only, migration 250) ──
const { savePullMode, clubMembersForOrg } = useCrossClubMembers()
const orgLevel = ref<string | null>(null)
const isGoverning = computed(() => !!orgLevel.value && orgLevel.value !== 'CLUB')
const peopleScope = ref<'own' | 'club'>('own')
const clubMembers = ref<any[]>([])
const clubLoading = ref(false)
const pullMode = ref<'reference' | 'copy'>('reference')
async function loadClubMembers() {
  if (!orgId.value || !isGoverning.value) return
  clubLoading.value = true
  clubMembers.value = await clubMembersForOrg(orgId.value)
  clubLoading.value = false
}
async function setPullMode(m: 'reference' | 'copy') {
  pullMode.value = m
  if (orgId.value) await savePullMode(orgId.value, m)
}
async function loadGoverning() {
  if (!orgId.value) return
  const { data } = await (db.from as any)('organisations').select('org_level, member_pull_mode').eq('id', orgId.value).maybeSingle()
  orgLevel.value = data?.org_level ?? null
  pullMode.value = data?.member_pull_mode === 'copy' ? 'copy' : 'reference'
  if (isGoverning.value) loadClubMembers()
}
const clubMembersFiltered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return clubMembers.value
  return clubMembers.value.filter((p: any) => `${p.first_name ?? ''} ${p.last_name ?? ''} ${p.email ?? ''} ${p.club_name}`.toLowerCase().includes(q))
})

// ── People | Admins | Organisations top-level view ──
const view = ref<'people' | 'admins' | 'organisations'>('people')

// ── Admins: people with an access-granting type (or a legacy permission group) ──
const accessTypeKeys = ref<Set<string>>(new Set())
const adminMemberIds = ref<Set<string>>(new Set())
async function loadAdmins() {
  if (!orgId.value) return
  const [{ data: types }, mem] = await Promise.all([
    (db.from as any)('person_target_types').select('key').eq('org_id', orgId.value).eq('is_access', true),
    (db.from as any)('permission_group_members').select('person_id, group:permission_groups!inner(org_id)').eq('group.org_id', orgId.value).then((r: any) => r).catch(() => ({ data: [] })),
  ])
  accessTypeKeys.value = new Set((types ?? []).map((t: any) => t.key))
  adminMemberIds.value = new Set(((mem?.data) ?? []).map((m: any) => m.person_id))
}
function adminTypeKeys(p: any): string[] { return typeKeysOf(p).filter(k => accessTypeKeys.value.has(k)) }

// Admins type tabs (mirror the People tabs, but over the access-granting types).
const adminActiveType = ref('all')
const adminAccessTypes = computed(() => personTypes.value.filter(t => accessTypeKeys.value.has(t.key)))
const adminTypeTabs = computed(() => [{ key: 'all', label: 'All' }, ...adminAccessTypes.value.map(t => ({ key: t.key, label: t.label }))])
const adminTypeCounts = computed(() => {
  const base = people.value.filter(isAdminPerson)
  const c: Record<string, number> = { all: base.length }
  for (const t of adminAccessTypes.value) c[t.key] = base.filter(p => typeKeysOf(p).includes(t.key)).length
  return c
})

// Add-admin: pick (or create) a person + give them an access-granting type.
const addAdminOpen = ref(false)
const addAdminPersonId = ref<string | null>(null)
const addAdminTypeKey = ref<string | null>(null)
const savingAdmin = ref(false)
const adminNewMode = ref(false)   // true = create a new person instead of picking one
const newAdmin = reactive({ first_name: '', last_name: '', email: '', phone: '' })
const adminTypeOptions = computed(() => personTypes.value.filter(t => accessTypeKeys.value.has(t.key)).map(t => ({ label: t.label, value: t.key })))
const personPickOptions = computed(() => people.value
  .map(p => ({ label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() + (p.email ? ` · ${p.email}` : ''), value: p.id }))
  .sort((a, b) => a.label.localeCompare(b.label)))
const canSaveAdmin = computed(() => !!addAdminTypeKey.value && (adminNewMode.value
  ? !!(newAdmin.first_name.trim() || newAdmin.last_name.trim())
  : !!addAdminPersonId.value))
function openAddAdmin() {
  addAdminPersonId.value = null
  addAdminTypeKey.value = adminTypeOptions.value[0]?.value ?? null
  adminNewMode.value = false
  newAdmin.first_name = ''; newAdmin.last_name = ''; newAdmin.email = ''; newAdmin.phone = ''
  addAdminOpen.value = true
}
async function saveAddAdmin() {
  if (!canSaveAdmin.value || !addAdminTypeKey.value) return
  savingAdmin.value = true
  const typeKey = addAdminTypeKey.value
  // NEW person → create with the admin type, then open their profile.
  if (adminNewMode.value) {
    const { data: created, error } = await (db.from as any)('persons').insert({
      org_id: orgId.value,
      first_name: newAdmin.first_name.trim() || null,
      last_name: newAdmin.last_name.trim() || null,
      email: newAdmin.email.trim() || null,
      phone: newAdmin.phone.trim() || null,
      person_types: [typeKey], person_type: typeKey,
    }).select('id').single()
    savingAdmin.value = false
    if (error || !created) { toast.add({ severity: 'error', summary: 'Could not create admin', detail: error?.message, life: 4000 }); return }
    addAdminOpen.value = false
    navigateTo(`/people/${created.id}#profile`)
    return
  }
  // EXISTING person → append the access type.
  const p = people.value.find(x => x.id === addAdminPersonId.value)
  const existing = p ? typeKeysOf(p) : []
  const arr = existing.includes(typeKey) ? existing : [...existing, typeKey]
  const { error } = await (db.from as any)('persons')
    .update({ person_types: arr, person_type: arr[0] ?? typeKey }).eq('id', addAdminPersonId.value)
  savingAdmin.value = false
  if (error) { toast.add({ severity: 'error', summary: 'Could not add admin', detail: error.message, life: 4000 }); return }
  if (p) { p.person_types = arr; p.person_type = arr[0] ?? typeKey }
  addAdminOpen.value = false
  toast.add({ severity: 'success', summary: 'Admin added', life: 2000 })
}
function isAdminPerson(p: any): boolean { return adminTypeKeys(p).length > 0 || adminMemberIds.value.has(p.id) }
const admins = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = people.value.filter(isAdminPerson)
  if (adminActiveType.value !== 'all') list = list.filter(p => typeKeysOf(p).includes(adminActiveType.value))
  if (q) list = list.filter(p => `${p.first_name ?? ''} ${p.last_name ?? ''} ${p.email ?? ''} ${p.phone ?? ''}`.toLowerCase().includes(q))
  return list
})
const entityTypes = ref<any[]>([])
const entityRows = ref<any[]>([])
const entityCounts = ref<Record<string, number>>({})
const activeEntityType = ref<string | null>(null)
const entLoading = ref(false)
const showNewEntity = ref(false)
const newEntityName = ref('')
const newEntityType = ref<string | null>(null)
const entityTypeLabel = (key: string) => entityTypes.value.find(t => t.key === key)?.label || key
async function loadEntitiesView() {
  entLoading.value = true
  const all = await loadOrgTypes(orgId.value as string)
  entityTypes.value = (all ?? []).filter((t: any) => t.kind === 'entity')
  const [rows, counts] = await Promise.all([loadEntities(activeEntityType.value || undefined), memberCounts()])
  entityRows.value = rows; entityCounts.value = counts
  entLoading.value = false
}
function openNewEntity() {
  newEntityName.value = ''
  newEntityType.value = activeEntityType.value || entityTypes.value[0]?.key || null
  showNewEntity.value = true
}
async function createEntityRow() {
  if (!newEntityName.value.trim() || !newEntityType.value) return
  try {
    const id = await createEntity(newEntityType.value, newEntityName.value.trim())
    showNewEntity.value = false
    navigateTo(`/organisations/${id}`)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not create', detail: e?.message, life: 4000 })
  }
}
watch([view, activeEntityType], () => { if (view.value === 'organisations') loadEntitiesView() })

// ── Per-tab column configuration ──
// Toggleable core columns (Name is always shown). Custom fields are added per
// tab from the org's field catalogue. Visible set is stored per tab on the org.
const CORE_COLS = [
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'roles', label: 'Roles' },
  { key: 'membership', label: 'Membership' },
  { key: 'age', label: 'Age' },
]
const DEFAULT_COLS = CORE_COLS.map(c => c.key) // custom fields default off
const colConfig = ref<Record<string, string[]>>({})
const colMenuOpen = ref(false)
const colMenuWrap = ref<HTMLElement | null>(null)

const activeTabLabel = computed(() => typeTabs.value.find(t => t.key === activeType.value)?.label ?? 'All')

// Custom-field columns offered for a tab — fields applying to that type
// (union of all for the 'all' tab).
function customColsForTab(tabKey: string) {
  const fields = tabKey === 'all'
    ? customFields.value
    : customFields.value.filter(f => fieldAppliesTo(f, tabKey))
  return fields.map(f => ({ key: `cf:${f.id}`, label: f.label, fieldId: f.id, field_type: f.field_type }))
}
const availableCols = computed(() => [...CORE_COLS, ...customColsForTab(activeType.value)])
const visibleCols = computed(() => colConfig.value[activeType.value] ?? DEFAULT_COLS)
const visibleColSet = computed(() => new Set(visibleCols.value))
const customColDefs = computed(() => customColsForTab(activeType.value).filter(c => visibleColSet.value.has(c.key)))

function toggleCol(key: string, on: boolean) {
  const current = new Set(colConfig.value[activeType.value] ?? DEFAULT_COLS)
  if (on) current.add(key); else current.delete(key)
  colConfig.value = { ...colConfig.value, [activeType.value]: [...current] }
  saveColumns()
}
let saveColsTimer: ReturnType<typeof setTimeout> | null = null
function saveColumns() {
  if (saveColsTimer) clearTimeout(saveColsTimer)
  saveColsTimer = setTimeout(async () => {
    await (db.from as any)('organisations').update({ people_columns: colConfig.value }).eq('id', orgId.value)
  }, 500)
}
function cfDisplay(data: any, col: any) {
  const v = data.custom_fields?.[col.fieldId]
  if (v === null || v === undefined || v === '') return '—'
  if (col.field_type === 'checkbox') return v ? 'Yes' : 'No'
  return String(v)
}
function onColDocClick(e: MouseEvent) {
  if (colMenuOpen.value && colMenuWrap.value && !colMenuWrap.value.contains(e.target as Node)) colMenuOpen.value = false
}
const loading = ref(true)
const search = ref('')
const showCreate = ref(false)
const creating = ref(false)
const newPerson = ref({ first_name: '', last_name: '', email: '', phone: '', person_type: null as string | null })
const rowMenu = ref()
const menuItems = ref<any[]>([])
const selected = ref<any[]>([])
const bulkType = ref<string | null>(null)

// A person's role keys — the multi array, falling back to the legacy single type.
function typeKeysOf(p: any): string[] { return p?.person_types?.length ? p.person_types : (p?.person_type ? [p.person_type] : []) }
// The People view shows only NON-access types (members/gymnasts, parents, emergency
// contacts…). Access-granting types (Admin/Committee/Manager) live on the Admins tab.
const nonAdminTypes = computed(() => personTypes.value.filter(t => !accessTypeKeys.value.has(t.key)))
// A person is "admin-only" when every type they hold is access-granting — those are
// hidden from People (they show on Admins). Untyped people stay under People.
function isAdminOnly(p: any): boolean {
  const keys = typeKeysOf(p)
  return keys.length > 0 && keys.every(k => accessTypeKeys.value.has(k))
}
const typeTabs = computed(() => [{ key: 'all', label: 'All' }, ...nonAdminTypes.value.map(t => ({ key: t.key, label: t.label }))])
// Counts respect the location lens (same rule as the table rows).
const lensPeople = computed(() => {
  if (!lensLocation.value) return people.value
  return people.value.filter(p => {
    const locs = personLocations.value[p.id]
    return !locs || !locs.length || locs.includes(lensLocation.value!)
  })
})
// People-view population: the lens people, minus anyone who is ONLY an admin.
const peoplePopulation = computed(() => lensPeople.value.filter(p => !isAdminOnly(p)))
const typeCounts = computed(() => {
  const c: Record<string, number> = { all: peoplePopulation.value.length }
  for (const t of nonAdminTypes.value) c[t.key] = peoplePopulation.value.filter(p => typeKeysOf(p).includes(t.key)).length
  return c
})
function typeLabel(key: string) { return personTypes.value.find(t => t.key === key)?.label ?? key }

// Location lens: a person "belongs" to a location via class memberships or a
// location_staff assignment. People with NO location connections at all stay
// visible under any lens (parents/admins would otherwise vanish confusingly).
const { activeLocationId: lensLocation } = useActiveLocation()
const personLocations = ref<Record<string, string[]>>({})
const filtered = computed(() => {
  let list = peoplePopulation.value
  if (activeType.value !== 'all') list = list.filter(p => typeKeysOf(p).includes(activeType.value))
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
    (p.email || '').toLowerCase().includes(q) ||
    (p.phone || '').toLowerCase().includes(q) ||
    (p.membership_type || '').toLowerCase().includes(q)
  )
})

function initials(p: any) {
  return `${(p.first_name || '').charAt(0)}${(p.last_name || '').charAt(0)}`.toUpperCase() || '?'
}

const PALETTE = ['#1E2157', '#0f766e', '#9333ea', '#c2410c', '#0369a1', '#be123c', '#15803d', '#4338ca']
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function age(dob: string | null) {
  if (!dob) return '—'
  const d = new Date(dob)
  if (isNaN(d.getTime())) return '—'
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a >= 0 && a < 130 ? String(a) : '—'
}

function openPerson(row: any) {
  navigateTo(`/people/${row.id}`)
}

async function loadTypes() {
  const all = await resolvePersonTypes(orgId.value as string)
  personTypes.value = (all ?? []).filter((t: any) => (t.kind ?? 'person') === 'person')
  customFields.value = await resolveFields(orgId.value as string)
}

async function loadColumns() {
  const { data } = await (db.from as any)('organisations').select('people_columns').eq('id', orgId.value).single()
  colConfig.value = (data?.people_columns && typeof data.people_columns === 'object') ? data.people_columns : {}
}

async function load() {
  loading.value = true
  const [{ data }, { data: mships }, { data: lstaff }] = await Promise.all([
    (db.from as any)('persons').select('*').eq('org_id', orgId.value).order('last_name', { ascending: true }),
    (db.from as any)('member_group_memberships').select('person_id, group:member_groups!inner(org_id, location_id)').eq('group.org_id', orgId.value),
    (db.from as any)('location_staff').select('person_id, location_id').eq('org_id', orgId.value),
  ])
  people.value = data ?? []
  const locMap: Record<string, string[]> = {}
  for (const m of (mships ?? [])) {
    const lid = m.group?.location_id
    if (lid) (locMap[m.person_id] ??= []).push(lid)
  }
  for (const s2 of (lstaff ?? [])) (locMap[s2.person_id] ??= []).push(s2.location_id)
  personLocations.value = locMap
  loading.value = false
}

function openCreate() {
  // Prefill the type from the active tab (or the first type), so tagging is one less step.
  newPerson.value.person_type = activeType.value !== 'all' ? activeType.value : (personTypes.value[0]?.key ?? null)
  showCreate.value = true
}

async function handleCreate() {
  if (!newPerson.value.first_name.trim() || !newPerson.value.last_name.trim() || !newPerson.value.person_type) return
  creating.value = true
  const { data, error } = await (db.from as any)('persons').insert({
    org_id: orgId.value,
    first_name: newPerson.value.first_name.trim(),
    last_name: newPerson.value.last_name.trim(),
    person_type: newPerson.value.person_type,
    person_types: [newPerson.value.person_type],
  }).select('id').maybeSingle()
  creating.value = false
  if (error || !data?.id) {
    toast.add({ severity: 'error', summary: 'Could not add person', detail: error?.message, life: 4000 })
    return
  }
  showCreate.value = false
  newPerson.value = { first_name: '', last_name: '', email: '', phone: '', person_type: null }
  // Straight to the new person's profile (renders their type's layout) to finish.
  navigateTo(`/people/${data.id}#profile`)
}

async function bulkSetType(typeKey: string | null) {
  const ids = selected.value.map(p => p.id)
  if (!ids.length) return
  const { error } = await (db.from as any)('persons').update({ person_type: typeKey, person_types: typeKey ? [typeKey] : null }).in('id', ids)
  if (!error) {
    toast.add({ severity: 'success', summary: `Type set for ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`, life: 2500 })
    selected.value = []
    bulkType.value = null
    load()
  } else {
    toast.add({ severity: 'error', summary: 'Could not set type', detail: error.message, life: 4000 })
  }
}

// Shared export matrix — visible columns + selected (or filtered) rows.
function peopleExportRows() {
  const rows = selected.value.length ? selected.value : filtered.value
  const cols: { label: string; get: (p: any) => string }[] = [
    { label: 'Name', get: p => `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() },
  ]
  if (visibleColSet.value.has('email')) cols.push({ label: 'Email', get: p => p.email ?? '' })
  if (visibleColSet.value.has('phone')) cols.push({ label: 'Phone', get: p => p.phone ?? '' })
  if (visibleColSet.value.has('roles')) cols.push({ label: 'Roles', get: p => typeKeysOf(p).map(typeLabel).join('; ') })
  if (visibleColSet.value.has('membership')) cols.push({ label: 'Membership', get: p => p.membership_type ?? '' })
  if (visibleColSet.value.has('age')) cols.push({ label: 'Age', get: p => { const a = age(p.dob); return a == null ? '' : String(a) } })
  for (const c of customColDefs.value) cols.push({ label: c.label, get: p => String(cfDisplay(p, c) ?? '') })
  return { head: cols.map(c => c.label), rows: rows.map(p => cols.map(c => c.get(p))), count: rows.length }
}
const exportFileBase = () => `people-${activeType.value}`
function downloadPeople(content: BlobPart, mime: string, ext: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = `${exportFileBase()}.${ext}`; a.click()
  URL.revokeObjectURL(url)
}
function peopleTableHtml() {
  const { head, rows } = peopleExportRows()
  const th = head.map(h => `<th style="border:1px solid #ccc;padding:4px 8px;background:#1E2157;color:#fff;font-size:11px">${h}</th>`).join('')
  const trs = rows.map(r => `<tr>${r.map(c => `<td style="border:1px solid #ccc;padding:4px 8px;font-size:11px">${c}</td>`).join('')}</tr>`).join('')
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
}
function exportCsv() {
  const { head, rows, count } = peopleExportRows()
  if (!count) { toast.add({ severity: 'info', summary: 'Nothing to export', life: 2000 }); return }
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\n')
  downloadPeople('﻿' + csv, 'text/csv;charset=utf-8;', 'csv')
}
function exportExcel() {
  if (!peopleExportRows().count) { toast.add({ severity: 'info', summary: 'Nothing to export', life: 2000 }); return }
  downloadPeople('﻿<html><head><meta charset="utf-8"></head><body><h3>People</h3>' + peopleTableHtml() + '</body></html>', 'application/vnd.ms-excel', 'xls')
}
function exportPdf() {
  if (!peopleExportRows().count) { toast.add({ severity: 'info', summary: 'Nothing to export', life: 2000 }); return }
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) { document.body.removeChild(iframe); return }
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>People</title><style>@page{size:landscape;margin:14mm}body{margin:0;font-family:Arial,sans-serif}</style></head><body><h2 style="color:#1E2157;margin:0 0 12px">People</h2>${peopleTableHtml()}</body></html>`)
  doc.close()
  const win = iframe.contentWindow!
  setTimeout(() => { win.focus(); win.print(); setTimeout(() => document.body.removeChild(iframe), 1500) }, 300)
}
const exportMenu = ref()
const exportItems = [
  { label: 'CSV', icon: 'pi pi-file', command: () => exportCsv() },
  { label: 'Excel', icon: 'pi pi-file-excel', command: () => exportExcel() },
  { label: 'PDF', icon: 'pi pi-file-pdf', command: () => exportPdf() },
  { separator: true },
  { label: 'Print', icon: 'pi pi-print', command: () => exportPdf() },
]

async function bulkDelete() {
  const ids = selected.value.map(p => p.id)
  if (!ids.length) return
  if (!window.confirm(`Delete ${ids.length} ${ids.length === 1 ? 'person' : 'people'}? This can't be undone.`)) return
  const { error } = await (db.from as any)('persons').delete().in('id', ids)
  if (!error) {
    toast.add({ severity: 'success', summary: `Deleted ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`, life: 2500 })
    selected.value = []
    load()
  } else {
    toast.add({ severity: 'error', summary: 'Delete failed', detail: error.message, life: 4000 })
  }
}

function openMenu(event: Event, row: any) {
  menuItems.value = [
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: async () => {
        await (db.from as any)('persons').delete().eq('id', row.id)
        toast.add({ severity: 'success', summary: 'Person deleted', life: 3000 })
        load()
      },
    },
  ]
  rowMenu.value.toggle(event)
}

// The nav "People" flyout drives the view via ?view=people|admins|organisations.
function applyViewFromQuery() {
  const v = route.query.view
  if (v === 'admins' || v === 'organisations' || v === 'people') view.value = v
  if (view.value === 'organisations' && typeof route.query.type === 'string') activeEntityType.value = route.query.type
}
watch(() => route.query.view, applyViewFromQuery)
onMounted(() => {
  applyViewFromQuery()
  load(); loadTypes(); loadColumns(); loadGoverning(); loadAdmins()
  document.addEventListener('click', onColDocClick)
})
onBeforeUnmount(() => document.removeEventListener('click', onColDocClick))
</script>
