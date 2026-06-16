<template>
  <div class="flex flex-1 min-h-0 bg-[#F5F8FA]">

    <!-- ────────────────────────────────────────────────────────── -->
    <!-- LEFT PANEL                                                  -->
    <!-- ────────────────────────────────────────────────────────── -->
    <aside class="w-[420px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

      <!-- ── SECTION NAV (default) ── -->
      <template v-if="!selectedSection && !editingFieldKey">
        <div class="px-5 pt-5 pb-4 shrink-0">
          <button v-if="showBack" type="button"
            class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0e43a3] transition-colors mb-2"
            @click="$emit('back')">
            <i class="pi pi-chevron-left text-[10px]" />
            All Forms
          </button>
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <input v-model="form.name"
                placeholder="Untitled form"
                class="text-base font-bold text-gray-900 bg-transparent border-0 outline-none p-0 focus:ring-0 w-full" />
              <p class="text-xs text-gray-400 mt-0.5">{{ completedCount }} of {{ sections.length }} sections complete</p>
            </div>
            <div class="shrink-0 mt-1">
              <div class="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div class="h-full rounded-full bg-[#1ab4e8] transition-all"
                  :style="`width:${sections.length ? (completedCount/sections.length)*100 : 0}%`" />
              </div>
            </div>
          </div>
        </div>
        <FormSectionList :sections="sections" @select="(id: string) => selectedSection = id as any" />
        <!-- Footer actions -->
        <div class="px-4 py-4 border-t border-gray-100 space-y-2 shrink-0">
          <button type="button" class="w-full py-2.5 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="$emit('done')">Done</button>
          <div class="flex items-center justify-between pt-1">
            <span class="text-xs text-gray-300">&nbsp;</span>
            <button v-if="canDelete" type="button" class="text-xs text-red-400 hover:text-red-600 transition-colors" @click="$emit('delete')">Delete form</button>
          </div>
        </div>
      </template>

      <!-- ── SETTINGS PANEL ── -->
      <!-- ── WHO IS REGISTERING (profiles) ── -->
      <template v-else-if="selectedSection === 'people'">
        <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="selectedSection = ''">
            <i class="pi pi-chevron-left text-sm" />
          </button>
          <div class="flex-1">
            <p class="text-sm font-bold text-gray-900">Who is registering</p>
            <p class="text-xs text-gray-400">The people this form collects, and how many of each</p>
          </div>
          <button type="button" class="px-3 py-1.5 bg-[#1ab4e8] hover:bg-[#16a0d0] text-white text-xs font-semibold rounded-lg transition-colors" @click="markSaved('people')">Save</button>
        </div>
        <div class="px-4 py-4 space-y-3 overflow-y-auto flex-1">
          <div v-if="!profiles.length" class="text-sm text-gray-400 italic py-2 text-center">No people added yet — add who this form registers.</div>
          <div v-for="(p, i) in profiles" :key="p.key" class="border border-gray-200 rounded-xl p-3 bg-gray-50/40">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-user text-gray-400 text-sm" />
              <span class="flex-1 font-semibold text-sm text-gray-800">{{ p.label }}</span>
              <button type="button" class="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" @click="removeProfile(i)">
                <i class="pi pi-trash text-xs" />
              </button>
            </div>
            <div class="flex items-center gap-2 text-xs text-gray-600">
              <span>How many?</span>
              <span class="text-gray-400">min</span><InputNumber v-model="p.min" :min="0" class="w-16" />
              <span class="text-gray-400">max</span><InputNumber v-model="p.max" :min="0" placeholder="∞" class="w-16" />
            </div>
          </div>
          <div v-if="unusedPersonTypes.length" class="pt-1">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Add a person</p>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="t in unusedPersonTypes" :key="t.key" type="button"
                class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:border-[#1E2157] hover:bg-blue-50/40 transition-all"
                @click="addProfile(t.key)">+ {{ t.label }}</button>
            </div>
          </div>
          <p v-else-if="!availablePersonTypes.length" class="text-xs text-gray-400">No person types defined yet — create them in Fields → Person Types.</p>
        </div>
      </template>

      <template v-else-if="selectedSection === 'settings'">
        <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="selectedSection = ''">
            <i class="pi pi-chevron-left text-sm" />
          </button>
          <div class="flex-1">
            <p class="text-sm font-bold text-gray-900">Settings</p>
            <p class="text-xs text-gray-400">Form details &amp; behaviour</p>
          </div>
          <button type="button" class="px-3 py-1.5 bg-[#1ab4e8] hover:bg-[#16a0d0] text-white text-xs font-semibold rounded-lg transition-colors" @click="markSaved('settings')">Save</button>
        </div>
        <div class="px-4 py-4 space-y-5 overflow-y-auto flex-1">
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Name</p>
            <input v-model="form.name" placeholder="e.g. Birthday party details" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
          </div>
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Description</p>
            <Textarea v-model="form.description" rows="2" auto-resize placeholder="What this form collects" class="w-full text-sm" />
          </div>
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Form Heading</p>
            <input v-model="form.settings.formHeading" placeholder="Fill in the form to register" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
          </div>
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Submit button text</p>
            <input v-model="form.settings.submitLabel" placeholder="Submit" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
          </div>
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Confirmation message</p>
            <Textarea v-model="form.settings.confirmMessage" rows="2" auto-resize placeholder="Thanks! We'll be in touch shortly." class="w-full text-sm" />
          </div>
        </div>
      </template>

      <!-- ── FIELDS PANEL ── -->
      <template v-else-if="selectedSection === 'fields' || editingFieldKey">

        <!-- Field editor -->
        <template v-if="editingField">
          <div class="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 shrink-0">
            <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" @click="closeFieldEditor">
              <i class="pi pi-chevron-left text-sm" />
            </button>
            <p class="flex-1 text-sm font-bold text-gray-900 truncate">{{ editingField.label || 'Untitled Field' }}</p>
            <button v-if="!editingField.core" type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#0e43a3] transition-colors" title="Duplicate" @click="duplicateField(editingField)">
              <i class="pi pi-copy text-sm" />
            </button>
            <button v-if="!editingField.core" type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete" @click="removeField(editingField); closeFieldEditor()">
              <i class="pi pi-trash text-sm" />
            </button>
          </div>
          <!-- Details / Advanced tabs -->
          <div class="flex border-b border-gray-100 shrink-0">
            <button type="button"
              class="flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2"
              :class="fieldEditorTab === 'details' ? 'text-[#1E2157] border-[#1E2157]' : 'text-gray-400 hover:text-gray-600 border-transparent'"
              @click="fieldEditorTab = 'details'">Details</button>
            <button type="button"
              class="flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2"
              :class="fieldEditorTab === 'advanced' ? 'text-[#1E2157] border-[#1E2157]' : 'text-gray-400 hover:text-gray-600 border-transparent'"
              @click="fieldEditorTab = 'advanced'">
              Advanced
              <span v-if="advancedCount(editingField) > 0" class="ml-1 text-[9px] bg-[#1E2157]/10 text-[#1E2157] rounded-full px-1.5 py-0.5">{{ advancedCount(editingField) }}</span>
            </button>
          </div>

          <!-- Details tab -->
          <div v-if="fieldEditorTab === 'details'" class="overflow-y-auto flex-1 px-4 py-4 space-y-5">
            <div v-if="editingField.core" class="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <i class="pi pi-lock text-blue-500 text-xs mt-0.5" />
              <p class="text-xs text-blue-700 flex-1 leading-relaxed">Core booking field — required by the system. You can rename it, change its width or position, but it can't be removed or made optional.</p>
            </div>
            <div class="space-y-1.5">
              <label class="text-sm font-semibold text-gray-800">Label <span class="text-red-400">*</span></label>
              <input v-model="editingField.label" type="text" placeholder="Question text" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-800">Required?</span>
              <ToggleSwitch v-model="editingField.is_required" :disabled="['first_name','last_name','email'].includes(editingField.core ?? '')" />
            </div>
            <div class="space-y-2">
              <span class="text-sm font-semibold text-gray-800">Width</span>
              <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                <button type="button"
                  class="flex-1 py-2 transition-colors border-r border-gray-200"
                  :class="editingField.col_span === 1 ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'"
                  @click="editingField.col_span = 1">Half</button>
                <button type="button"
                  class="flex-1 py-2 transition-colors"
                  :class="editingField.col_span === 2 ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'"
                  @click="editingField.col_span = 2">Full</button>
              </div>
            </div>
            <div v-if="!editingField.core" class="space-y-2">
              <label class="text-sm font-semibold text-gray-800">Input Type <span class="text-red-400">*</span></label>
              <div class="grid grid-cols-2 gap-1.5">
                <button v-for="ft in fieldTypes" :key="ft.value" type="button"
                  class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all"
                  :class="editingField.field_type === ft.value
                    ? 'border-[#1E2157] bg-[#1E2157]/5 ring-1 ring-[#1E2157]/30'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'"
                  @click="editingField.field_type = ft.value">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    :class="editingField.field_type === ft.value ? 'bg-[#1E2157]/10' : 'bg-gray-50'">
                    <i :class="`pi ${ft.icon} text-xs`"
                      :style="editingField.field_type === ft.value ? 'color:#1E2157' : 'color:#6b7280'" />
                  </div>
                  <span class="text-xs font-semibold flex-1 text-left"
                    :class="editingField.field_type === ft.value ? 'text-[#1E2157]' : 'text-gray-700'">{{ ft.label }}</span>
                </button>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-800">Placeholder</span>
                <ToggleSwitch v-model="editingField.has_placeholder" />
              </div>
              <input v-if="editingField.has_placeholder" v-model="editingField.placeholder" type="text" placeholder="Enter placeholder text" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-800">Helper Text</span>
                <ToggleSwitch v-model="editingField.has_helper_text" />
              </div>
              <input v-if="editingField.has_helper_text" v-model="editingField.helper_text" type="text" placeholder="Enter helper text" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
            </div>
            <div v-if="editingField.field_type === 'select'" class="space-y-1.5">
              <label class="text-sm font-semibold text-gray-800">Options</label>
              <Textarea v-model="editingField._optionsText" rows="3" auto-resize placeholder="One option per line" class="w-full text-sm" />
            </div>
          </div>

          <!-- Advanced tab — visibility conditions + financial increase rules -->
          <FormFieldAdvancedEditor v-else
            :field="editingField"
            :condition-field-options="conditionFieldOptions" />
        </template>

        <!-- Field library -->
        <template v-else>
          <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
            <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="selectedSection = ''">
              <i class="pi pi-chevron-left text-sm" />
            </button>
            <div class="flex-1">
              <p class="text-sm font-bold text-gray-900">Form</p>
              <p class="text-xs text-gray-400">Choose what data to collect</p>
            </div>
            <button type="button" class="px-3 py-1.5 bg-[#1ab4e8] hover:bg-[#16a0d0] text-white text-xs font-semibold rounded-lg transition-colors" @click="markSaved('fields')">Save</button>
          </div>
          <div class="flex border-b border-gray-100 shrink-0">
            <button type="button" class="flex-1 py-2.5 text-xs font-semibold transition-colors"
              :class="fieldsTab === 'existing' ? 'text-[#0e43a3] border-b-2 border-[#0e43a3]' : 'text-gray-400 hover:text-gray-600'"
              @click="fieldsTab = 'existing'">Existing Fields</button>
            <button type="button" class="flex-1 py-2.5 text-xs font-semibold transition-colors"
              :class="fieldsTab === 'new' ? 'text-[#0e43a3] border-b-2 border-[#0e43a3]' : 'text-gray-400 hover:text-gray-600'"
              @click="fieldsTab = 'new'">Create New</button>
          </div>

          <!-- Existing fields tab -->
          <div v-if="fieldsTab === 'existing'" class="px-4 py-3 overflow-y-auto space-y-4 flex-1">
            <p class="text-xs text-gray-400 flex items-center gap-1.5">
              <i class="pi pi-info-circle text-[11px]" />
              Drag fields onto the form or click <i class="pi pi-plus text-[10px]" />
            </p>
            <div v-for="group in allFieldGroups" :key="group.label">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">{{ group.label }}</p>
              <div class="space-y-0.5">
                <div v-for="pf in group.fields" :key="pf.label"
                  :draggable="!isFieldAdded(pf.label)"
                  class="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-transparent transition-all group"
                  :class="isFieldAdded(pf.label)
                    ? 'opacity-40 cursor-default'
                    : pf.required
                      ? 'bg-red-50 border-red-200 hover:bg-red-100/70 cursor-grab active:cursor-grabbing'
                      : 'hover:bg-blue-50/40 hover:border-blue-100 cursor-grab active:cursor-grabbing'"
                  @dragstart="onPaletteDragStart('PEOPLE:' + pf.label, $event)"
                  @dragend="onPaletteDragEnd">
                  <i class="pi pi-bars text-gray-300 text-xs" :class="{ 'opacity-0': isFieldAdded(pf.label) }" />
                  <i class="pi text-xs shrink-0" :class="[pf.icon, isFieldAdded(pf.label) ? 'text-green-400' : 'text-gray-300']" />
                  <span class="flex-1 text-sm" :class="isFieldAdded(pf.label) ? 'text-gray-500' : 'text-gray-700'">{{ pf.label }}</span>
                  <span v-if="pf.required" :title="'Required by ' + (pf.requiredBy || 'your governing body')" class="text-[9px] font-bold uppercase tracking-wide text-red-500 bg-red-100 px-1.5 py-0.5 rounded shrink-0 cursor-help">Required</span>
                  <span v-if="isFieldAdded(pf.label)" class="text-[10px] text-green-500 font-medium">Added</span>
                  <button v-else type="button"
                    class="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-[#0e43a3] opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-blue-50"
                    @click="addPeopleField(pf)">
                    <i class="pi pi-plus text-xs" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Create new tab -->
          <div v-if="fieldsTab === 'new'" class="overflow-y-auto flex-1">

            <!-- ADD A BLOCK -->
            <div class="px-4 pt-4 pb-3 border-b border-gray-100">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Add a block</p>
              <div class="grid grid-cols-4 gap-1.5">
                <button v-for="bt in blockTypes" :key="bt.type" type="button"
                  class="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border border-gray-100 hover:border-gray-200 transition-all"
                  :class="bt.bg"
                  @click="addBlock(bt.type)">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="bt.iconBg">
                    <i :class="`pi ${bt.icon} text-sm`" :style="`color:${bt.color}`" />
                  </div>
                  <span class="text-[10px] font-semibold text-gray-600">{{ bt.label }}</span>
                </button>
              </div>
            </div>

            <!-- CUSTOM FIELD -->
            <div class="px-4 pt-4 pb-3">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Custom field</p>
              <input v-model="newField.label" type="text" placeholder="Field label e.g. Preferred Name"
                class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] mb-3" />
              <div class="grid grid-cols-2 gap-1.5 mb-3">
                <button v-for="ft in fieldTypes" :key="ft.value" type="button"
                  class="px-3 py-2 rounded-lg border text-xs font-semibold transition-colors"
                  :class="newField.type === ft.value
                    ? 'bg-[#1E2157] border-[#1E2157] text-white'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'"
                  @click="newField.type = ft.value">{{ ft.label }}</button>
              </div>
              <input v-model="newField.placeholder" type="text" placeholder="Placeholder text (optional)"
                class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] mb-3" />
              <button type="button"
                class="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50"
                :class="newField.label.trim() ? 'bg-[#1ab4e8] hover:bg-[#16a0d0]' : 'bg-[#1ab4e8]/60 cursor-not-allowed'"
                :disabled="!newField.label.trim()"
                @click="addCustomField">
                Add Field to Form
              </button>
            </div>
          </div>
        </template>
      </template>

      <!-- ── TERMS PANEL ── -->
      <template v-else-if="selectedSection === 'terms'">
        <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
          <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="selectedSection = ''">
            <i class="pi pi-chevron-left text-sm" />
          </button>
          <div class="flex-1">
            <p class="text-sm font-bold text-gray-900">Terms &amp; Conditions</p>
            <p class="text-xs text-gray-400">Consent the user must give to submit</p>
          </div>
          <button type="button" class="px-3 py-1.5 bg-[#1ab4e8] hover:bg-[#16a0d0] text-white text-xs font-semibold rounded-lg transition-colors" @click="markSaved('terms')">Save</button>
        </div>
        <div class="px-4 py-4 space-y-3 overflow-y-auto flex-1">
          <div v-if="!form.terms.length" class="text-sm text-gray-400 italic py-3 text-center">No terms yet.</div>
          <div v-for="(t, i) in form.terms" :key="t._key"
            class="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-gray-50/40">
            <div class="flex items-center gap-2">
              <input v-model="t.label" type="text" placeholder="Title (e.g. NZ Sport Terms)" class="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white" />
              <button type="button" class="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                @click="form.terms.splice(i, 1)">
                <i class="pi pi-trash text-xs" />
              </button>
            </div>
            <Textarea v-model="t.agreeText" rows="2" auto-resize placeholder="Agreement text shown to the user" class="w-full text-sm bg-white" />
            <label class="flex items-center gap-2 cursor-pointer">
              <Checkbox v-model="t.required" :binary="true" />
              <span class="text-xs font-medium text-gray-600">Required to submit</span>
            </label>
          </div>
          <button type="button" class="w-full py-2.5 rounded-xl bg-[#1E2157] hover:bg-[#161a45] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            @click="form.terms.push({ _key: freshKey(), label: '', agreeText: '', required: false })">
            <i class="pi pi-plus text-xs" />Add Term
          </button>
        </div>
      </template>

    </aside>

    <!-- ────────────────────────────────────────────────────────── -->
    <!-- RIGHT PANEL — LIVE PREVIEW                                  -->
    <!-- ────────────────────────────────────────────────────────── -->
    <div class="relative flex-1 overflow-hidden bg-[#EBEFFA]">
      <div class="absolute inset-0 overflow-y-auto z-10">

        <!-- Form card -->
        <div class="relative max-w-[1000px] mx-auto my-6 bg-white rounded-lg shadow-lg overflow-hidden">

          <!-- Title bar -->
          <div class="px-6 py-5 border-b border-gray-100">
            <h2 class="text-lg font-bold text-gray-900">{{ context.title || form.name || 'Form Title' }}</h2>
          </div>

          <!-- Info icons row -->
          <div v-if="hasContextIcons" class="px-6 pt-7 pb-5">
            <div class="grid grid-cols-3 gap-3">
              <div v-if="context.date" class="flex items-start gap-2">
                <i class="pi pi-calendar text-gray-400 text-sm mt-0.5 shrink-0" />
                <div class="text-sm"><p class="font-semibold text-gray-600">Date:</p><p class="text-gray-500">{{ context.date }}</p></div>
              </div>
              <div v-if="context.time" class="flex items-start gap-2">
                <i class="pi pi-clock text-gray-400 text-sm mt-0.5 shrink-0" />
                <div class="text-sm"><p class="font-semibold text-gray-600">Time:</p><p class="text-gray-500">{{ context.time }}</p></div>
              </div>
              <div v-if="context.cost" class="flex items-start gap-2">
                <i class="pi pi-dollar text-gray-400 text-sm mt-0.5 shrink-0" />
                <div class="text-sm"><p class="font-semibold text-gray-600">Cost:</p><p class="text-gray-500">{{ context.cost }}</p></div>
              </div>
              <div v-if="context.location" class="flex items-start gap-2">
                <i class="pi pi-map-marker text-gray-400 text-sm mt-0.5 shrink-0" />
                <div class="text-sm"><p class="font-semibold text-gray-600">Location:</p><p class="text-gray-500">{{ context.location }}</p></div>
              </div>
              <div v-if="context.restrictions" class="flex items-start gap-2">
                <i class="pi pi-user text-gray-400 text-sm mt-0.5 shrink-0" />
                <div class="text-sm"><p class="font-semibold text-gray-600">Invitee Restrictions:</p><p class="text-gray-500">{{ context.restrictions }}</p></div>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div v-if="context.description || form.description" class="px-6 py-5">
            <p class="text-sm text-gray-600 leading-relaxed">{{ context.description || form.description }}</p>
          </div>

          <!-- Form heading -->
          <div class="px-6 pt-6 pb-5">
            <h3 class="text-xl font-bold text-gray-800">{{ form.settings.formHeading || 'Fill in the form to register' }}</h3>
          </div>

          <!-- Fields body -->
          <div class="px-6 pb-6 space-y-4">
            <FormFieldCanvas
              :modelValue="form.fields"
              @update:modelValue="form.fields = $event"
              :editing-key="editingFieldKey"
              :pinned-roles="['first_name', 'last_name']"
              @select="openFieldEditor"
              @drop="onCanvasPayloadDrop">
              <template #empty-action>
                <button type="button" class="mt-1 text-sm text-[#0e43a3] hover:underline" @click="openCreateNew">or create a new field</button>
              </template>
            </FormFieldCanvas>
          </div>

          <!-- Terms preview -->
          <div v-if="form.terms.length" class="px-6 pb-6">
            <h3 class="text-base font-bold text-gray-800 mb-3">Terms &amp; Conditions</h3>
            <div class="space-y-2">
              <label v-for="t in form.terms" :key="t._key" class="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white">
                <input type="checkbox" class="mt-1 w-4 h-4 rounded border-gray-300 accent-[#1E2157] pointer-events-none" />
                <div class="flex-1">
                  <p class="text-sm font-semibold text-gray-800">{{ t.label || 'Untitled term' }}<span v-if="t.required" class="text-red-400 ml-1">*</span></p>
                  <p v-if="t.agreeText" class="text-xs text-gray-500 mt-1 leading-relaxed">{{ t.agreeText }}</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Submit footer -->
          <div class="px-6 py-5 border-t border-gray-100 flex items-center justify-end">
            <button type="button" class="px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm pointer-events-none"
              style="background:#1E2157">{{ form.settings.submitLabel || 'Submit' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface FieldCondition {
  id: string
  field: string
  operator: string
  value: string
}
interface FinancialRule {
  id: string
  conditions: FieldCondition[]
  account_code: string
  fee_name: string
  fee_type: 'increase' | 'discount'
  amount: number | null
}
interface FormBuilderField {
  _key: string
  id?: string
  field_type: string
  label: string
  is_required: boolean
  placeholder: string
  has_placeholder: boolean
  helper_text: string
  has_helper_text: boolean
  col_span: 1 | 2
  _optionsText: string
  core?: 'first_name' | 'last_name' | 'email' | 'phone' | 'attendees' | 'notes' // booking-system core fields — can't delete or change type
  has_visibility_conditions?: boolean
  visibility_conditions?: FieldCondition[]
  has_financial_increase?: boolean
  financial_rules?: FinancialRule[]
}
interface FormBuilderModel {
  name: string
  description: string
  fields: FormBuilderField[]
  terms: { _key: string; label: string; agreeText: string; required: boolean }[]
  settings: {
    submitLabel: string
    confirmMessage: string
    formHeading: string
  }
  sectionSaved: Record<string, boolean>
  profiles?: { key: string; label: string; min: number; max: number | null }[]
}
interface FormBuilderContext {
  title?: string
  date?: string
  time?: string
  cost?: string
  location?: string
  restrictions?: string
  headerImage?: string
  description?: string
}

const props = defineProps<{
  modelValue: FormBuilderModel
  context?: FormBuilderContext
  showBack?: boolean
  canDelete?: boolean
  allowMultiplePersons?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: FormBuilderModel): void
  (e: 'back'): void
  (e: 'done'): void
  (e: 'delete'): void
}>()

const form = computed({
  get: () => props.modelValue,
  set: (v: FormBuilderModel) => emit('update:modelValue', v),
})

const context = computed<FormBuilderContext>(() => props.context ?? {})
const hasContextIcons = computed(() => {
  const c = context.value
  return !!(c.date || c.time || c.cost || c.location || c.restrictions)
})

// ── Section nav state ───────────────────────────────────────
const selectedSection = ref<'' | 'people' | 'settings' | 'fields' | 'terms'>('')

// Person types (who can be registered) — own + inherited from governing bodies.
const _fbOrg2 = useOrg()
const { resolvePersonTypes: _fbResolvePersonTypes } = useOrgFieldPolicy()
const availablePersonTypes = ref<{ key: string; label: string; min_count: number; max_count: number | null }[]>([])
watch(() => _fbOrg2.orgId.value, async (id) => {
  availablePersonTypes.value = id ? await _fbResolvePersonTypes(id) : []
}, { immediate: true })
const profiles = computed(() => form.value.profiles ?? [])
function addProfile(key: string) {
  const t = availablePersonTypes.value.find(x => x.key === key)
  if (!t || profiles.value.some(p => p.key === key)) return
  if (!form.value.profiles) form.value.profiles = []
  form.value.profiles.push({ key: t.key, label: t.label, min: t.min_count ?? 1, max: t.max_count })
}
function removeProfile(i: number) { form.value.profiles?.splice(i, 1) }
const unusedPersonTypes = computed(() => availablePersonTypes.value.filter(t => !profiles.value.some(p => p.key === t.key)))
const fieldsTab = ref<'existing' | 'new'>('existing')
const editingFieldKey = ref<string | null>(null)
const fieldEditorTab = ref<'details' | 'advanced'>('details')
const editingField = computed(() =>
  editingFieldKey.value ? form.value.fields.find(f => f._key === editingFieldKey.value) ?? null : null,
)
// When the user picks a different field, snap back to Details so they don't
// land on Advanced for a brand-new field.
watch(editingFieldKey, () => { fieldEditorTab.value = 'details' })

// ── Advanced tab: list of other fields available as condition references ──
const conditionFieldOptions = computed(() => {
  const skipTypes = new Set(['section', 'image', 'text-block', 'text_block', 'button'])
  return form.value.fields.filter(f =>
    f._key !== editingFieldKey.value && !skipTypes.has(f.field_type) && !!f.label,
  )
})

function advancedCount(f: FormBuilderField | null): number {
  if (!f) return 0
  let n = 0
  if (f.has_visibility_conditions && (f.visibility_conditions ?? []).length) n += 1
  if (f.has_financial_increase && (f.financial_rules ?? []).length) n += (f.financial_rules ?? []).length
  return n
}

const sections = computed(() => [
  { id: 'people',   label: 'Who is registering', icon: 'pi-users',       complete: !!form.value.profiles?.length, subtitle: form.value.profiles?.length ? form.value.profiles.map(p => p.label).join(', ') : 'Not set' },
  { id: 'settings', label: 'Settings',           icon: 'pi-cog',         complete: form.value.sectionSaved.settings, subtitle: form.value.sectionSaved.settings ? 'Saved' : 'Not configured' },
  { id: 'fields',   label: 'Form',               icon: 'pi-list',        complete: form.value.sectionSaved.fields, subtitle: form.value.sectionSaved.fields ? 'Saved' : (form.value.fields.length ? `${form.value.fields.length} field${form.value.fields.length === 1 ? '' : 's'}` : 'Not configured') },
  { id: 'terms',    label: 'Terms & Conditions', icon: 'pi-file',        complete: form.value.sectionSaved.terms,    subtitle: form.value.sectionSaved.terms ? 'Saved' : (form.value.terms.length ? `${form.value.terms.length} term${form.value.terms.length === 1 ? '' : 's'}` : 'Not configured') },
])
const completedCount = computed(() => sections.value.filter(s => s.complete).length)
function markSaved(key: string) {
  form.value.sectionSaved[key] = true
  selectedSection.value = ''
  editingFieldKey.value = null
}

const fieldTypes = [
  { label: 'Short Text', value: 'text',     icon: 'pi-font' },
  { label: 'Long Text',  value: 'textarea', icon: 'pi-align-left' },
  { label: 'Email',      value: 'email',    icon: 'pi-envelope' },
  { label: 'Phone',      value: 'phone',    icon: 'pi-phone' },
  { label: 'Number',     value: 'number',   icon: 'pi-hashtag' },
  { label: 'Date',       value: 'date',     icon: 'pi-calendar' },
  { label: 'Dropdown',   value: 'select',   icon: 'pi-list' },
  { label: 'Checkbox',   value: 'checkbox', icon: 'pi-check-square' },
]

const blockTypes = [
  { type: 'section', label: 'Section', icon: 'pi-th-large',     color: '#a855f7', bg: 'bg-purple-50/40', iconBg: 'bg-purple-100' },
  { type: 'image',   label: 'Image',   icon: 'pi-image',        color: '#22c55e', bg: 'bg-green-50/40',  iconBg: 'bg-green-100' },
  { type: 'text',    label: 'Text',    icon: 'pi-align-left',   color: '#f97316', bg: 'bg-orange-50/40', iconBg: 'bg-orange-100' },
  { type: 'button',  label: 'Button',  icon: 'pi-external-link',color: '#ec4899', bg: 'bg-pink-50/40',   iconBg: 'bg-pink-100' },
]

const newField = reactive({ label: '', type: 'text', placeholder: '' })
function addCustomField() {
  if (!newField.label.trim()) return
  const f: FormBuilderField = {
    _key: freshKey(),
    field_type: newField.type,
    label: newField.label.trim(),
    is_required: false,
    placeholder: newField.placeholder,
    has_placeholder: !!newField.placeholder,
    helper_text: '',
    has_helper_text: false,
    col_span: 2,
    _optionsText: '',
  }
  form.value.fields.push(f)
  newField.label = ''
  newField.placeholder = ''
  newField.type = 'text'
  editingFieldKey.value = f._key
}

function addBlock(type: string) {
  const labels: Record<string, string> = {
    section: 'Section heading', image: 'Image', text: 'Text block', button: 'Button',
  }
  const f: FormBuilderField = {
    _key: freshKey(),
    field_type: type, // 'section' | 'image' | 'text' | 'button'
    label: labels[type] ?? 'Block',
    is_required: false,
    placeholder: '',
    has_placeholder: false,
    helper_text: '',
    has_helper_text: false,
    col_span: 2,
    _optionsText: '',
  }
  form.value.fields.push(f)
  editingFieldKey.value = f._key
}

const peopleFieldGroups = [
  {
    label: 'Identity',
    fields: [
      { label: 'First Name',     type: 'text', icon: 'pi-user' },
      { label: 'Last Name',      type: 'text', icon: 'pi-user' },
      { label: 'Email Address',  type: 'text', icon: 'pi-envelope' },
      { label: 'Phone Number',   type: 'text', icon: 'pi-phone' },
      { label: 'Date of Birth',  type: 'date', icon: 'pi-calendar' },
    ],
  },
  {
    label: 'Membership',
    fields: [
      { label: 'Member Number',        type: 'text',     icon: 'pi-id-card' },
      { label: 'Club',                 type: 'text',     icon: 'pi-flag' },
      { label: 'Emergency Contact',    type: 'textarea', icon: 'pi-users' },
      { label: 'Medical Notes',        type: 'textarea', icon: 'pi-heart' },
      { label: 'Dietary Requirements', type: 'textarea', icon: 'pi-apple' },
    ],
  },
  {
    label: 'Common extras',
    fields: [
      { label: 'T-Shirt Size',        type: 'select', icon: 'pi-tag', options: ['S', 'M', 'L', 'XL', 'XXL'] },
      { label: 'Bus Pickup Location', type: 'text',   icon: 'pi-map-marker' },
      { label: 'Team Name',           type: 'text',   icon: 'pi-users' },
    ],
  },
]
// Org field library (the field engine) surfaced in the palette so you can drag
// your own + inherited NSO fields onto any form.
const _fbOrg = useOrg()
const { resolveFields: _fbResolveFields } = useOrgFieldPolicy()
const orgDefs = ref<any[]>([])
const PALETTE_ICON: Record<string, string> = { text: 'pi-font', textarea: 'pi-align-left', email: 'pi-envelope', phone: 'pi-phone', number: 'pi-hashtag', date: 'pi-calendar', select: 'pi-list', checkbox: 'pi-check-square' }
const PALETTE_TYPE: Record<string, string> = { email: 'text', phone: 'text' }
watch(() => _fbOrg.orgId.value, async (id) => {
  orgDefs.value = id ? await _fbResolveFields(id) : []
}, { immediate: true })
const orgPaletteGroups = computed(() => {
  const mapF = (d: any) => ({ label: d.label, type: PALETTE_TYPE[d.field_type] || d.field_type, icon: PALETTE_ICON[d.field_type] || 'pi-tag', options: d.options || [], required: !!d.is_required, requiredBy: d.ownerName })
  const groups: any[] = []
  const ownDefs = orgDefs.value.filter((d: any) => !d.inherited)
  const inhDefs = orgDefs.value.filter((d: any) => d.inherited)
  if (ownDefs.length) groups.push({ label: 'Organisation fields', fields: ownDefs.map(mapF) })
  if (inhDefs.length) groups.push({ label: 'Inherited (NSO) fields', fields: inhDefs.map(mapF) })
  return groups
})
// System/Identity group first, then org fields, then the rest.
const allFieldGroups = computed(() => [peopleFieldGroups[0], ...orgPaletteGroups.value, ...peopleFieldGroups.slice(1)])

function isFieldAdded(label: string) {
  return form.value.fields.some(f => f.label === label || (f.core && CORE_LABELS[f.core] === label))
}
const CORE_LABELS: Record<string, string> = {
  first_name: 'First Name', last_name: 'Last Name', email: 'Email Address', phone: 'Phone Number',
  attendees: 'People Attending', notes: 'Notes',
}
function findPeopleField(label: string) {
  for (const g of allFieldGroups.value) {
    const f = g.fields.find((x: any) => x.label === label)
    if (f) return f
  }
  return null
}

// ── Field actions ───────────────────────────────────────────
function freshKey() { return crypto.randomUUID() }

function makeField(type: string): FormBuilderField {
  const labels: Record<string, string> = {
    text: 'Short answer', textarea: 'Long answer', number: 'Number', date: 'Date',
    checkbox: 'Yes / no', select: 'Dropdown', file: 'File upload',
  }
  return {
    _key: freshKey(),
    field_type: type,
    label: labels[type] ?? 'Question',
    is_required: false,
    placeholder: '',
    has_placeholder: false,
    helper_text: '',
    has_helper_text: false,
    col_span: 2,
    _optionsText: '',
  }
}
function addField(type: string) {
  const f = makeField(type)
  form.value.fields.push(f)
  editingFieldKey.value = f._key
  selectedSection.value = 'fields'
}
function addPeopleField(pf: { label: string; type: string; options?: string[] }) {
  if (isFieldAdded(pf.label)) return
  form.value.fields.push({
    _key: freshKey(),
    field_type: pf.type,
    label: pf.label,
    is_required: false,
    placeholder: '',
    has_placeholder: false,
    helper_text: '',
    has_helper_text: false,
    col_span: 2,
    _optionsText: (pf.options ?? []).join('\n'),
  })
}
function duplicateField(f: FormBuilderField) {
  const copy = { ...f, _key: freshKey(), id: undefined, label: `${f.label} (copy)` }
  const idx = form.value.fields.findIndex(x => x._key === f._key)
  form.value.fields.splice(idx + 1, 0, copy)
  editingFieldKey.value = copy._key
}
function removeField(f: FormBuilderField) {
  const idx = form.value.fields.findIndex(x => x._key === f._key)
  if (idx >= 0) form.value.fields.splice(idx, 1)
}
function openFieldEditor(key: string) {
  selectedSection.value = 'fields'
  editingFieldKey.value = key
}
function closeFieldEditor() {
  editingFieldKey.value = null
}
function openCreateNew() {
  selectedSection.value = 'fields'
  fieldsTab.value = 'new'
  editingFieldKey.value = null
}
function selectOptions(f: FormBuilderField): string[] {
  return (f._optionsText || '').split('\n').map(s => s.trim()).filter(Boolean)
}

// ── Sidebar palette → canvas drag-and-drop ────────────────────
function onPaletteDragStart(payload: string, e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    try { e.dataTransfer.setData('text/plain', payload) } catch {}
  }
}
function onPaletteDragEnd() {}
function onCanvasPayloadDrop(payload: string) {
  if (!payload) return
  if (payload.startsWith('TYPE:')) {
    addField(payload.slice(5))
  } else if (payload.startsWith('PEOPLE:')) {
    const pf = findPeopleField(payload.slice(7))
    if (pf) addPeopleField(pf)
  }
}
</script>
