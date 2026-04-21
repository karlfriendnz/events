<template>
  <div class="p-6 max-w-4xl space-y-8">

    <!-- ── CATEGORIES ──────────────────────────────────────────── -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Categories</h2>
          <p class="text-sm text-gray-500 mt-0.5">Colour-coded labels assigned directly to events.</p>
        </div>
        <Button label="New Category" icon="pi pi-plus" size="small"
          @click="openCatCreate" style="background:#1E2157; border-color:#1E2157" />
      </div>

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div v-if="catsLoading" class="p-8 flex justify-center">
          <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
        </div>
        <div v-else-if="!categories.length" class="text-center py-10 text-gray-400">
          <i class="pi pi-tag text-3xl mb-3 block" />
          <p class="text-sm">No categories yet.</p>
        </div>
        <div v-else class="divide-y divide-gray-100">
          <div v-for="cat in categories" :key="cat.id"
            class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              :style="{ background: cat.color ?? '#1E2157' }">
              <i :class="`${cat.icon ?? 'pi pi-tag'} text-white text-sm`" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900">{{ cat.name }}</p>
              <p class="text-xs text-gray-400">{{ cat._eventCount ?? 0 }} events</p>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openCatEdit(cat)" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteCategory(cat)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── CALENDARS ───────────────────────────────────────────── -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Calendars</h2>
          <p class="text-sm text-gray-500 mt-0.5">Named groupings of categories for filtering the calendar view.</p>
        </div>
        <Button label="New Calendar" icon="pi pi-plus" size="small"
          @click="openCalCreate" style="background:#1E2157; border-color:#1E2157" />
      </div>

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div v-if="calsLoading" class="p-8 flex justify-center">
          <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
        </div>
        <div v-else-if="!calendars.length" class="text-center py-10 text-gray-400">
          <i class="pi pi-calendar text-3xl mb-3 block" />
          <p class="text-sm">No calendars yet. Create one to group categories for filtering.</p>
        </div>
        <div v-else class="divide-y divide-gray-100">
          <div v-for="cal in calendars" :key="cal.id"
            class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
            <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <i class="pi pi-calendar text-gray-500 text-sm" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900">{{ cal.name }}</p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <template v-if="cal.categoryIds?.length">
                  <span v-for="catId in cal.categoryIds.slice(0, 5)" :key="catId"
                    class="flex items-center gap-1 text-xs text-gray-500">
                    <span class="w-2 h-2 rounded-full shrink-0"
                      :style="{ background: catById[catId]?.color ?? '#94a3b8' }" />
                    {{ catById[catId]?.name ?? '?' }}
                  </span>
                  <span v-if="cal.categoryIds.length > 5" class="text-xs text-gray-400">
                    +{{ cal.categoryIds.length - 5 }} more
                  </span>
                </template>
                <span v-else class="text-xs text-gray-400 italic">No categories assigned</span>
              </div>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openCalEdit(cal)" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteCalendar(cal)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── CATEGORY DIALOG ─────────────────────────────────────── -->
    <Dialog v-model:visible="showCatDialog" :header="editingCat ? 'Edit Category' : 'New Category'" modal style="width:420px">
      <div class="flex flex-col gap-4 py-1">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="catForm.name" autofocus placeholder="e.g. Training, Competition, Social" />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Colour</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="c in colorPalette" :key="c"
              class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              :class="catForm.color === c ? 'border-gray-900 scale-110' : 'border-transparent'"
              :style="{ background: c }"
              @click="catForm.color = c" />
            <input type="color" v-model="catForm.color" class="w-7 h-7 rounded cursor-pointer border border-gray-200" />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Icon</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="icon in iconOptions" :key="icon"
              class="w-8 h-8 rounded-lg border flex items-center justify-center text-sm transition-colors"
              :class="catForm.icon === icon ? 'border-[#1E2157] bg-[#EFF6FF] text-[#1E2157]' : 'border-gray-200 text-gray-500 hover:border-gray-400'"
              @click="catForm.icon = icon">
              <i :class="`pi pi-${icon}`" />
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" :style="{ background: catForm.color || '#1E2157' }">
            <i :class="`pi pi-${catForm.icon || 'tag'} text-white text-sm`" />
          </div>
          <span class="text-sm font-medium text-gray-700">{{ catForm.name || 'Category name' }}</span>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCatDialog = false" />
        <Button :label="editingCat ? 'Save' : 'Create'" :loading="catSaving"
          :disabled="!catForm.name.trim()" @click="saveCat"
          style="background:#1E2157; border-color:#1E2157" />
      </template>
    </Dialog>

    <!-- ── CALENDAR DIALOG ─────────────────────────────────────── -->
    <Dialog v-model:visible="showCalDialog" :header="editingCal ? 'Edit Calendar' : 'New Calendar'" modal style="width:440px">
      <div class="flex flex-col gap-4 py-1">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="calForm.name" autofocus placeholder="e.g. All Events, Juniors, Competitive Season" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Categories</label>
          <MultiSelect
            v-model="calForm.categoryIds"
            :options="categories"
            option-label="name"
            option-value="id"
            placeholder="Select categories to include…"
            display="chip"
            class="w-full"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: option.color ?? '#94a3b8' }" />
                <span>{{ option.name }}</span>
              </div>
            </template>
          </MultiSelect>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCalDialog = false" />
        <Button :label="editingCal ? 'Save' : 'Create'" :loading="calSaving"
          :disabled="!calForm.name.trim()" @click="saveCal"
          style="background:#1E2157; border-color:#1E2157" />
      </template>
    </Dialog>

    <ConfirmDialog />
    <Toast />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

const db = useDb()
const toast = useToast()
const confirm = useConfirm()

// ── Categories ──────────────────────────────────────────────────
const categories = ref<any[]>([])
const catsLoading = ref(true)
const showCatDialog = ref(false)
const catSaving = ref(false)
const editingCat = ref<any>(null)
const catForm = reactive({ name: '', color: '#1E2157', icon: 'tag' })

const catById = computed(() => Object.fromEntries(categories.value.map(c => [c.id, c])))

const colorPalette = [
  '#1E2157', '#3B82F6', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
  '#6B7280', '#1EA97C', '#F97316', '#84CC16',
]
const iconOptions = [
  'calendar', 'users', 'trophy', 'bolt', 'flag',
  'star', 'heart', 'tag', 'briefcase', 'home',
  'map-marker', 'clock', 'shield', 'book', 'graduation-cap',
]

async function loadCategories() {
  catsLoading.value = true
  const { data } = await db.from('categories')
    .select('*, events:events(id)')
    .eq('org_id', orgId.value)
    .order('sort_order')
    .order('name')
  categories.value = (data ?? []).map((c: any) => ({ ...c, _eventCount: c.events?.length ?? 0 }))
  catsLoading.value = false
}

function openCatCreate() {
  editingCat.value = null
  catForm.name = ''
  catForm.color = '#1E2157'
  catForm.icon = 'tag'
  showCatDialog.value = true
}

function openCatEdit(cat: any) {
  editingCat.value = cat
  catForm.name = cat.name
  catForm.color = cat.color ?? '#1E2157'
  catForm.icon = (cat.icon ?? 'pi-tag').replace('pi-', '')
  showCatDialog.value = true
}

async function saveCat() {
  catSaving.value = true
  try {
    const payload = { org_id: orgId.value, name: catForm.name.trim(), color: catForm.color, icon: `pi-${catForm.icon}` }
    if (editingCat.value) {
      const { error } = await db.from('categories').update(payload).eq('id', editingCat.value.id)
      if (error) throw error
      toast.add({ severity: 'success', summary: 'Category updated', life: 3000 })
    } else {
      const { error } = await db.from('categories').insert(payload)
      if (error) throw error
      toast.add({ severity: 'success', summary: 'Category created', life: 3000 })
    }
    showCatDialog.value = false
    await loadCategories()
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Failed to save', detail: err?.message, life: 4000 })
  }
  catSaving.value = false
}

function deleteCategory(cat: any) {
  confirm.require({
    message: `Delete "${cat.name}"? Events using this category won't be deleted, just unassigned.`,
    header: 'Delete Category',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await db.from('categories').delete().eq('id', cat.id).eq('org_id', orgId.value)
      toast.add({ severity: 'success', summary: 'Category deleted', life: 3000 })
      await loadCategories()
    },
  })
}

// ── Calendars ───────────────────────────────────────────────────
const calendars = ref<any[]>([])
const calsLoading = ref(true)
const showCalDialog = ref(false)
const calSaving = ref(false)
const editingCal = ref<any>(null)
const calForm = reactive({ name: '', categoryIds: [] as string[] })

async function loadCalendars() {
  calsLoading.value = true
  const { data } = await (db.from as any)('calendars')
    .select('id, name, sort_order, calendar_categories(category_id)')
    .eq('org_id', orgId.value)
    .order('sort_order')
  calendars.value = (data ?? []).map((c: any) => ({
    ...c,
    categoryIds: c.calendar_categories?.map((cc: any) => cc.category_id) ?? [],
  }))
  calsLoading.value = false
}

function openCalCreate() {
  editingCal.value = null
  calForm.name = ''
  calForm.categoryIds = []
  showCalDialog.value = true
}

function openCalEdit(cal: any) {
  editingCal.value = cal
  calForm.name = cal.name
  calForm.categoryIds = [...(cal.categoryIds ?? [])]
  showCalDialog.value = true
}

async function saveCal() {
  calSaving.value = true
  try {
    if (editingCal.value) {
      const { error } = await (db.from as any)('calendars').update({ name: calForm.name.trim() }).eq('id', editingCal.value.id)
      if (error) throw error
      await (db.from as any)('calendar_categories').delete().eq('calendar_id', editingCal.value.id)
      if (calForm.categoryIds.length) {
        await (db.from as any)('calendar_categories').insert(
          calForm.categoryIds.map((cid: string) => ({ calendar_id: editingCal.value.id, category_id: cid }))
        )
      }
      toast.add({ severity: 'success', summary: 'Calendar updated', life: 3000 })
    } else {
      const { data, error } = await (db.from as any)('calendars')
        .insert({ org_id: orgId.value, name: calForm.name.trim() })
        .select('id').single()
      if (error) throw error
      if (data && calForm.categoryIds.length) {
        await (db.from as any)('calendar_categories').insert(
          calForm.categoryIds.map((cid: string) => ({ calendar_id: data.id, category_id: cid }))
        )
      }
      toast.add({ severity: 'success', summary: 'Calendar created', life: 3000 })
    }
    showCalDialog.value = false
    await loadCalendars()
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Failed to save', detail: err?.message, life: 4000 })
  }
  calSaving.value = false
}

function deleteCalendar(cal: any) {
  confirm.require({
    message: `Delete "${cal.name}"? This only removes the calendar grouping — events and categories are unaffected.`,
    header: 'Delete Calendar',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await (db.from as any)('calendars').delete().eq('id', cal.id).eq('org_id', orgId.value)
      toast.add({ severity: 'success', summary: 'Calendar deleted', life: 3000 })
      await loadCalendars()
    },
  })
}

onMounted(async () => {
  await loadCategories()
  await loadCalendars()
})
</script>
