<template>
  <!-- Pin overlays — Teleported to <body> with fixed positioning so they
       sit above modals (PrimeVue masks land at z-1100; we go far above).
       Coords are stored as <main>-relative so pins scroll with content;
       we just project into viewport space at render time. Inline style
       used for z-index so Tailwind's JIT can't accidentally drop it. -->
  <Teleport to="body">
    <!-- The pending pin, while you write its note in the panel. Shows WHERE it
         will land (resolved from its element, so it rides scrolling) — the pin
         used to be invisible until posted, so you were describing a spot you
         couldn't see. -->
    <div v-if="pendingPinPos" class="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2"
      :style="{ left: `${pendingPinPos.left}px`, top: `${pendingPinPos.top}px`, zIndex: 2147483000 }">
      <span class="absolute inset-0 -m-1 rounded-full bg-amber-400/50 animate-ping" />
      <div class="relative w-7 h-7 rounded-full bg-amber-400 ring-2 ring-white shadow-md flex items-center justify-center">
        <i class="pi pi-map-marker text-[11px] text-gray-900" />
      </div>
    </div>

    <div v-if="pinsVisible && screenPinPositions.length"
      class="fixed inset-0 pointer-events-none"
      style="z-index: 2147483000">
      <div
        v-for="p in screenPinPositions" :key="p.pin.id"
        class="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none"
        :style="{ left: `${p.left}px`, top: `${p.top}px` }"
        @click.stop="openComment(p.pin)">
        <!-- Hovering the comment's number in the panel pulses its pin here, so
             you can find which control a note refers to without clicking. -->
        <span v-if="hoverPinId === p.pin.id"
          class="absolute inset-0 -m-1 rounded-full animate-ping"
          :style="{ background: pinColorFor(p.pin), opacity: 0.55 }" />
        <!-- Ring carries STATE, the fill stays the reviewer's colour: dark =
             currently open in the panel, green = built and awaiting sign-off,
             white = untouched. So "what's already done" is readable from the
             page without opening the panel. Scale carries ATTENTION: focused,
             or hover-pulsed from the list. -->
        <div class="w-7 h-7 rounded-full shadow-md flex items-center justify-center text-[11px] font-bold transition-transform relative"
          :class="[
            focusedId === p.pin.id
              ? 'ring-[3px] ring-slate-800'
              : (p.pin.claude_status === 'done' ? 'ring-[3px] ring-emerald-500' : 'ring-2 ring-white'),
            hoverPinId === p.pin.id ? 'scale-150' : (focusedId === p.pin.id ? 'scale-110' : 'hover:scale-110'),
          ]"
          :style="{ background: pinColorFor(p.pin), color: pinTextColorFor(p.pin) }">
          {{ p.n }}
        </div>
      </div>
    </div>
    <!-- What you are about to attach to. Outlines the element under the cursor
         and names it, so choosing a target is a thing you can SEE rather than
         guess — nudge until the label reads the control you actually mean. -->
    <div v-if="(pinning || moving) && hoverBox" data-review-overlay
      class="fixed pointer-events-none"
      :style="{
        left: `${hoverBox.left}px`, top: `${hoverBox.top}px`,
        width: `${hoverBox.width}px`, height: `${hoverBox.height}px`,
        zIndex: 2147482999,
      }">
      <div class="absolute inset-0 rounded-sm"
        :class="moving ? 'ring-2 ring-slate-800 bg-slate-800/10' : 'ring-2 ring-amber-500 bg-amber-400/10'" />
      <!-- Label flips below the box when the element is near the top of the
           viewport, or it would be drawn off-screen. -->
      <div class="absolute left-0 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm max-w-[70vw] truncate"
        :class="[
          moving ? 'bg-slate-800 text-white' : 'bg-amber-500 text-white',
          hoverBox.top < 24 ? 'top-full mt-1' : 'bottom-full mb-1',
        ]">
        {{ hoverLine }}
      </div>
    </div>

    <div v-if="(pinning || moving) && cursorViewport"
      class="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2"
      :style="{ left: `${cursorViewport.x}px`, top: `${cursorViewport.y}px`, zIndex: 2147483000 }">
      <div class="w-7 h-7 rounded-full ring-2 ring-white shadow-md"
        :class="moving ? 'bg-slate-800/70' : 'bg-amber-400/60'" />
    </div>

    <!-- Modal-safe panel trigger. The header comment button sits under
         PrimeVue's dialog mask, so while a modal is open there is no way to
         open the panel. This floating twin is teleported above the mask and
         only appears in exactly that situation. -->
    <button v-if="modalOpen && !expanded" type="button"
      class="fixed top-3 right-4 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center text-primary hover:bg-gray-50"
      style="z-index: 2147483002"
      v-tooltip.left="'Comments & review'"
      @click="expanded = true">
      <i class="pi pi-comments text-base" />
      <span v-if="openCount > 0"
        class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
        {{ openCount }}
      </span>
    </button>
  </Teleport>

  <!-- Inline dock — placed in the layout header next to the prototype
       banner. The expanded panel pops out as a fixed overlay below the
       header so it stays reachable while a PrimeVue Dialog is open
       (their masks land at z-1100; we go far above). -->
  <div class="relative" style="z-index: 2147483001">
    <div v-if="!expanded && !hidePill"
      class="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full shadow-sm pl-2.5 pr-1 py-1">
      <button type="button"
        class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
        :class="stageChip"
        @click="expanded = true">
        {{ stageLabel }}
      </button>
      <!-- Show / hide on-screen pins. Doesn't affect the panel, just the
           coloured pins overlaid on the page itself. -->
      <button type="button"
        class="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        :class="pinsVisible ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-50'"
        @click="pinsVisible = !pinsVisible"
        v-tooltip.top="pinsVisible ? 'Hide on-screen pins' : 'Show on-screen pins'">
        <i :class="pinsVisible ? 'pi pi-eye' : 'pi pi-eye-slash'" class="text-sm" />
      </button>
      <!-- Quick add: drop a pin as the logged-in user without expanding the panel -->
      <button v-if="canPost" type="button"
        class="w-8 h-8 rounded-full flex items-center justify-center transition-colors text-white hover:opacity-90"
        :style="{ background: meReviewer.color || '#1E2157' }"
        @click="quickPin"
        v-tooltip.top="pinning ? 'Cancel pin' : `Add comment as ${meReviewer.name}`">
        <i :class="pinning ? 'pi pi-times' : 'pi pi-plus'" class="text-xs font-bold" />
      </button>
      <button type="button"
        class="relative w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-50"
        @click="expanded = true"
        v-tooltip.top="'Open review panel'">
        <i class="pi pi-comment text-sm" />
        <span v-if="openCount > 0"
          class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
          {{ openCount > 99 ? '99+' : openCount }}
        </span>
      </button>
    </div>

    <!-- Teleported to <body>: the widget is mounted inside the layout header,
         which is its own stacking context, so any z-index here is clamped
         under PrimeVue's body-level dialog mask (z-1100) and the panel becomes
         unclickable whenever a modal is open. Teleporting lifts it out so a
         comment can be pinned onto a dialog. -->
    <Teleport to="body">
    <div v-if="expanded"
      data-review-panel
      class="fixed top-0 right-0 bottom-0 w-full md:w-[440px] bg-white border-l border-gray-200 shadow-2xl overflow-hidden flex flex-col"
      style="z-index: 2147483001">
      <!-- Header: tab pills -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button v-for="t in panelTabs" :key="t.value" type="button"
            class="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors flex items-center gap-1"
            :class="panel === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
            @click="panel = t.value">
            {{ t.label }}
            <span v-if="t.value === 'signoffs' && reviewers.length"
              class="text-[9px] font-bold px-1 rounded"
              :class="signedCount === reviewers.length ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'">
              {{ signedCount }}/{{ reviewers.length }}
            </span>
            <span v-if="t.value === 'all' && allTasks.length"
              class="text-[9px] font-bold px-1 rounded bg-gray-200 text-gray-600">
              {{ allTasks.length }}
            </span>
          </button>
        </div>
        <div class="flex-1" />
        <button type="button" class="text-gray-400 hover:text-gray-600"
          @click="expanded = false">
          <i class="pi pi-times text-sm" />
        </button>
      </div>

      <!-- THIS PAGE panel -->
      <div v-if="panel === 'page'" class="flex-1 overflow-y-auto">
        <div v-if="!meReviewer && user" class="px-4 py-2 border-b border-amber-100 bg-amber-50 text-[11px] text-amber-800">
          <i class="pi pi-info-circle mr-1" />
          Signed in as <span class="font-mono">{{ user.email }}</span> — you don't have a reviewer profile yet.
          <button type="button" class="ml-1 font-semibold underline hover:no-underline disabled:opacity-50"
            :disabled="creatingReviewer" @click="createMyReviewer">
            {{ creatingReviewer ? 'Setting up…' : 'Set up my profile →' }}
          </button>
        </div>

        <!-- Stage row. Only the builder (Karl) gets the toggle; everyone
             else sees the current stage as a read-only chip. -->
        <div class="px-4 py-3 border-b border-gray-100">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Stage</p>
            <span v-if="!canEditStage"
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              :class="stageChip">
              {{ stageLabel }}
            </span>
          </div>
          <div v-if="canEditStage" class="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
            <button v-for="s in stages" :key="s.value" type="button"
              class="flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md transition-colors"
              :class="(review?.stage || 'draft') === s.value
                ? `${s.activeBg} text-white shadow-sm`
                : 'text-gray-500 hover:text-gray-700'"
              @click="setStage(s.value)">
              {{ s.label }}
            </button>
          </div>
          <p v-else class="text-[10px] text-gray-400 leading-snug">
            Use the Sign-offs tab to add your approval — Karl manages the stage.
          </p>
        </div>

        <!-- Quick sign-off action — your row from the Sign-offs tab,
             surfaced here so you can approve without switching tabs. -->
        <div v-if="meReviewer" class="px-4 py-3 border-b border-gray-100">
          <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">My sign-off</p>
          <div class="flex items-center gap-2 px-2 py-2 rounded-md bg-gray-50">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              :style="{ background: (meReviewer.color || '#1E2157') + '22', color: meReviewer.color || '#1E2157' }">
              {{ initialsOf(meReviewer.name) }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-gray-800 truncate">{{ meReviewer.name }}</p>
              <p v-if="meReviewer.role" class="text-[10px] text-gray-400 truncate">{{ meReviewer.role }}</p>
            </div>
            <button v-if="signoffsByReviewer[meReviewer.id]" type="button"
              class="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-red-600 transition-colors"
              v-tooltip.left="'Click to revoke'"
              @click="revokeSignoff(meReviewer)">
              <i class="pi pi-check-circle text-sm" />
              Signed {{ formatRelative(signoffsByReviewer[meReviewer.id].signed_at) }}
            </button>
            <button v-else type="button"
              class="px-3 py-1.5 text-[11px] font-semibold rounded-md text-white"
              style="background:#10b981"
              @click="signOff(meReviewer)">
              Sign off
            </button>
          </div>
        </div>

        <!-- Comments header / actions -->
        <div class="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Button
            :label="pinning ? 'Cancel pin' : 'Add comment'"
            :icon="pinning ? 'pi pi-times' : 'pi pi-map-marker'"
            size="small" outlined class="flex-1"
            :disabled="!canPost"
            @click="togglePinning" />
          <!-- Pin visibility lives here as well as on the pill: the pill is
               hidden in the default layout, so without this the toggle is a
               one-way door — pins off, no way back on. -->
          <button type="button"
            class="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors"
            :class="pinsVisible ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-50'"
            v-tooltip.top="pinsVisible ? 'Hide on-screen pins' : 'Show on-screen pins'"
            @click="pinsVisible = !pinsVisible">
            <i :class="pinsVisible ? 'pi pi-eye' : 'pi pi-eye-slash'" class="text-sm" />
          </button>
          <!-- "Hide resolved" lived here; the Resolved TAB below replaced it.
               A checkbox that hides things and a tab that shows them are two
               controls fighting over one question. -->
        </div>

        <!-- Hand the open comments to Claude as a task brief. Local dev only —
             it writes a file into the working tree. -->
        <div v-if="isDeveloper || canPost" class="px-4 py-2 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <Button
              :label="selectedIds.length ? `Send ${selectedIds.length} selected` : 'Send tasks to Claude'"
              icon="pi pi-android"
              size="small" class="flex-1" :loading="briefing"
              :disabled="!openCount"
              @click="sendToClaude"
              style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            <!-- Scope only matters when nothing is ticked; an explicit pick wins. -->
            <label v-if="!selectedIds.length"
              class="flex items-center gap-1.5 text-[11px] text-gray-500 select-none cursor-pointer shrink-0"
              v-tooltip.top="'Off = every open comment in the club, not just this page'">
              <input type="checkbox" v-model="briefThisPageOnly" class="accent-primary w-3 h-3" />
              This page
            </label>
            <button v-else type="button"
              class="text-[11px] text-gray-500 hover:text-gray-700 shrink-0"
              @click="selectedIds = []">Clear</button>
          </div>
          <p v-if="pendingCount" class="mt-1.5 text-[11px] text-slate-600">
            <i class="pi pi-inbox text-[10px]" />
            {{ pendingCount }} suggestion{{ pendingCount === 1 ? '' : 's' }} from the team
            {{ isBuilder ? 'waiting for you to mark ready' : 'waiting for Karl' }}.
          </p>
          <div v-if="selectableIds.length > 1" class="mt-1">
            <button type="button" class="text-[10px] text-gray-400 hover:text-primary"
              @click="toggleSelectAll">
              {{ allSelected ? 'Deselect all' : `Select all ${selectableIds.length}` }}
            </button>
            <span v-if="!selectedIds.length" class="text-[10px] text-gray-400 ml-2">
              · or tick individual comments to send just those
            </span>
          </div>
          <p v-if="briefResult" class="mt-1.5 text-[11px] text-emerald-700">
            <i class="pi pi-check-circle text-[10px]" />
            {{ briefResult.taskCount }} task{{ briefResult.taskCount === 1 ? '' : 's' }} written to
            <code class="bg-emerald-50 px-1 rounded">{{ briefResult.file }}</code> — tell Claude
            &ldquo;do the review tasks&rdquo;.
          </p>
          <p v-else-if="briefError" class="mt-1.5 text-[11px] text-red-600">{{ briefError }}</p>
        </div>

        <!-- Hint while pinning -->
        <div v-if="pinning" class="px-4 py-2 bg-amber-50 text-amber-800 text-[11px] border-b border-amber-100">
          <i class="pi pi-info-circle mr-1" /> Click anywhere on the page to drop a pin.
        </div>

        <!-- NEW comment composer. Lives in the panel, not a modal: you write the
             note with the element you just clicked still in front of you. -->
        <div v-if="composeOpen" class="px-4 py-3 border-b-4 border-gray-100 bg-amber-50/60">
          <div class="flex items-center gap-2 mb-1.5">
            <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-amber-400 text-gray-900">
              <i class="pi pi-map-marker text-[11px]" />
            </div>
            <span class="text-xs font-semibold text-gray-700 flex-1">New comment</span>
            <button type="button" class="text-gray-400 hover:text-gray-700"
              v-tooltip.left="'Cancel'" @click="cancelCompose">
              <i class="pi pi-times text-xs" />
            </button>
          </div>

          <!-- What the pin landed on, so you can tell before posting whether it
               caught the right control — and re-place it if not. -->
          <p v-if="composeWhere" class="text-[10px] text-gray-500 mb-1.5 truncate"
            v-tooltip.bottom="composeWhere">
            <i class="pi pi-map-marker text-[9px] mr-0.5" />{{ composeWhere }}
          </p>

          <!-- Drop an image straight onto the new comment. Uploaded now, attached
               the moment the comment exists — a screenshot is often the fastest
               way to say what's wrong, and making you post first then drag
               afterwards is a step nobody remembers to take. -->
          <div :class="composeDragOver ? 'ring-2 ring-primary rounded-md' : ''"
            @dragenter.prevent="onComposeDragEnter" @dragover.prevent="onComposeDragEnter"
            @dragleave="composeDragOver = false" @drop.prevent="onComposeDrop">
            <MentionTextarea ref="composeInput"
              v-model="composeBody"
              v-model:mentions="composeMentions"
              :reviewers="reviewers"
              :rows="3"
              placeholder="Describe what needs attention… @name, or drop an image" />
          </div>
          <div v-if="composeAttachments.length" class="mt-1.5 flex flex-wrap gap-1.5">
            <div v-for="(a, ai) in composeAttachments" :key="a.url" class="relative">
              <img :src="a.url" class="w-12 h-12 object-cover rounded border border-gray-200" />
              <button type="button"
                class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-gray-300 text-gray-400 hover:text-red-500 flex items-center justify-center"
                @click="composeAttachments.splice(ai, 1)">
                <i class="pi pi-times text-[8px]" />
              </button>
            </div>
          </div>
          <p v-if="composeUploading" class="mt-1 text-[10px] text-gray-400">
            <i class="pi pi-spin pi-spinner text-[9px] mr-1" />Uploading…
          </p>

          <div class="mt-2 flex items-center gap-2">
            <Button label="Re-place pin" icon="pi pi-arrows-alt" size="small" outlined
              @click="replacePin" />
            <span class="flex-1" />
            <button type="button" class="text-[11px] text-gray-500 hover:text-gray-700"
              @click="cancelCompose">Cancel</button>
            <Button label="Post" icon="pi pi-check" size="small"
              :disabled="!composeBody.trim()"
              @click="commitPin"
              style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>
        </div>

        <!-- FOCUSED comment — what you get when you click a pin on the page.
             Sits at the top of the panel, open for editing, with the page still
             fully visible beside it (the panel docks, it doesn't overlay). -->
        <div v-if="focused" class="px-4 py-3 border-b-4 border-gray-100 bg-primary/5">
          <div class="flex items-center gap-2 mb-1.5">
            <div v-if="focusedPinNumber"
              class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              :style="{ background: pinColorFor(focused), color: pinTextColorFor(focused) }">
              {{ focusedPinNumber }}
            </div>
            <span class="text-xs font-semibold text-gray-700 flex-1">
              {{ authorLabelFor(focused) }} · {{ formatRelative(focused.created_at) }}
            </span>
            <button type="button" class="text-gray-400 hover:text-gray-700"
              v-tooltip.left="'Close'" @click="closeFocused">
              <i class="pi pi-times text-xs" />
            </button>
          </div>

          <ReviewCommentBody :comment="focused" :editing="editOpenFor === focused.id" :can-approve="isBuilder" :reviewers="reviewers"
            v-model:draft="editBody" @save="saveEdit(focused)" @save-send="saveEditAndSend(focused)" @cancel="cancelEdit"
            @toggle-ready="setReady(focused, $event)"
            @attach="addAttachments(focused, $event)" @remove-attachment="removeAttachment(focused, $event)"
            @unqueue="unqueueComment(focused)" />

          <div class="mt-2 flex items-center gap-2 flex-wrap">
            <!-- Re-anchor. The capture takes the element under the cursor, which
                 is sometimes a wrapper rather than the control you meant — and
                 every comment made before capture existed has no element at
                 all, so this is how an old pin gets attached retrospectively. -->
            <Button v-if="!moving" label="Move pin" icon="pi pi-arrows-alt" size="small" outlined
              @click="startMove(focused)" />
            <Button v-else label="Click the right element…" icon="pi pi-times" size="small" outlined
              severity="warning" @click="cancelMove" />
            <button v-if="editOpenFor !== focused.id" type="button"
              class="text-[11px] text-gray-500 hover:text-primary" @click="startEdit(focused)">
              <i class="pi pi-pencil text-[10px]" /> Edit text
            </button>
            <!-- Delete lives here, not just behind the developer flag: a comment
                 you dropped by mistake shouldn't need a resolve (which files it
                 as reviewed work that was never work). Confirms first — it takes
                 any replies with it. -->
            <button v-if="canPost" type="button"
              class="text-[11px] text-gray-400 hover:text-red-600"
              @click="deleteComment(focused)">
              <i class="pi pi-trash text-[10px]" /> Delete
            </button>
            <span class="flex-1" />
            <Button v-if="!focused.resolved" label="Resolve" icon="pi pi-check" size="small"
              @click="resolveComment(focused)"
              style="background:#10b981;border-color:#10b981" />
            <Button v-else label="Reopen" icon="pi pi-undo" size="small"
              @click="reopenComment(focused)"
              style="background:#f59e0b;border-color:#f59e0b" />
          </div>
          <p v-if="moving" class="mt-1.5 text-[11px] text-amber-700">
            <i class="pi pi-info-circle text-[10px]" />
            Click the element this comment is about. Esc to cancel.
          </p>
        </div>

        <!-- Mentions aimed at ME, from any page. Sits above the tabs because
             being asked something directly outranks the queue you were working
             through. Collapsed to a one-line bar until opened. -->
        <div v-if="myMentions.length" class="px-4 pt-3">
          <button type="button"
            class="w-full flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5
                   text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
            @click="showMentions = !showMentions">
            <i class="pi pi-at text-[10px]" />
            <span class="flex-1 text-left">
              {{ myMentions.length }} comment{{ myMentions.length === 1 ? '' : 's' }} mention{{ myMentions.length === 1 ? 's' : '' }} you
            </span>
            <i :class="showMentions ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="text-[10px]" />
          </button>

          <div v-if="showMentions" class="mt-1.5 space-y-1.5">
            <div v-for="m in myMentions" :key="m.id"
              class="rounded-md border border-gray-100 p-2 hover:bg-gray-50">
              <p class="text-[10px] text-gray-400 mb-0.5">
                {{ authorLabelFor(m) }} · {{ formatRelative(m.created_at) }}
              </p>
              <p class="text-xs text-gray-700 whitespace-pre-wrap break-words">{{ m.body }}</p>
              <div class="mt-1 flex items-center gap-2">
                <code class="text-[10px] text-gray-400 truncate">{{ m.path }}</code>
                <span class="flex-1" />
                <!-- Same page → jump straight to it. Another page → navigate.
                     A templated path (/events/:id) can't be reconstructed, so it
                     says where rather than offering a link that would 404. -->
                <button v-if="m.path === pageKey" type="button"
                  class="text-[10px] font-semibold text-primary hover:underline"
                  @click="showMentions = false; openComment(m.parent_id ? comments.find(c => c.id === m.parent_id) || m : m)">
                  Show me
                </button>
                <button v-else-if="mentionPathNavigable(m.path)" type="button"
                  class="text-[10px] font-semibold text-primary hover:underline"
                  @click="goToMention(m)">
                  Go to page →
                </button>
                <span v-else class="text-[10px] text-gray-400">on a record page</span>
              </div>
            </div>
          </div>
        </div>

        <!-- To do / In progress. Sending a batch moves it out of the working
             list so the remaining comments are what you see — but it lands in a
             tab rather than disappearing, because "built, awaiting sign-off" is
             precisely what needs looking at. -->
        <div class="px-4 pt-3 flex items-center gap-1">
          <button v-for="t in [
              { key: 'todo', label: 'To do', count: todoCount },
              { key: 'inprogress', label: 'In progress', count: inProgressCount },
              { key: 'resolved', label: 'Resolved', count: resolvedCount },
            ]" :key="t.key" type="button"
            class="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5"
            :class="taskFilter === t.key
              ? 'bg-primary text-white'
              : 'text-gray-500 hover:bg-gray-100'"
            @click="taskFilter = t.key as any">
            {{ t.label }}
            <span v-if="t.count"
              class="px-1 rounded text-[10px]"
              :class="taskFilter === t.key ? 'bg-white/25' : 'bg-gray-200 text-gray-600'">{{ t.count }}</span>
          </button>
        </div>

        <!-- Comments list -->
        <div class="px-4 py-3 space-y-2">
          <p v-if="!openPinned.length && !resolvedPinned.length && !visibleGeneral.length"
            class="text-xs text-gray-400 text-center py-4">
            {{ taskFilter === 'inprogress' ? 'Nothing sent to Claude yet.'
              : taskFilter === 'resolved' ? 'Nothing resolved on this page yet.'
              : 'No comments on this page yet.' }}
          </p>

          <!-- Page-level notes lead the list: they are the "about this whole
               screen" comments, so they set up everything pinned below them.
               (They used to sit under the pins, where a note about the page as a
               whole read as an afterthought to a note about one button.) -->
          <div v-if="visibleGeneral.length" class="space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Page-level</p>
            <div v-for="c in visibleGeneral" :key="c.id"
              class="rounded-lg border hover:bg-gray-50"
              :class="[c.resolved ? 'opacity-60' : '', isSelected(c.id) ? 'border-primary bg-primary/5' : 'border-gray-100']">
              <div class="flex items-start gap-2 p-2">
                <!-- A comment aimed at a person has no tick — it can't be sent to
                     Claude, so the @ marks it as theirs instead. -->
                <i v-if="!c.resolved && routedToPerson(c)"
                  class="pi pi-at text-[10px] text-amber-500 mt-2 shrink-0"
                  v-tooltip.left="`For ${mentionNames(c)} — not sent to Claude`" />
                <input v-else-if="!c.resolved" type="checkbox"
                  class="accent-primary w-3 h-3 mt-2 shrink-0 cursor-pointer"
                  :disabled="!c.ready"
                  :class="c.ready ? '' : 'opacity-30 cursor-not-allowed'"
                  v-tooltip.left="c.ready ? 'Include when sending tasks to Claude' : 'Mark ready before sending'"
                  :checked="isSelected(c.id)" @change="toggleSelected(c.id)" />
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                  :style="{ background: pinColorFor(c), color: pinTextColorFor(c) }">
                  {{ initialsOf(authorLabelFor(c)) }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] text-gray-400 mb-0.5">
                    {{ authorLabelFor(c) }} · {{ formatRelative(c.created_at) }}
                    <span v-if="c.resolved" class="ml-1 text-emerald-600 font-semibold">· Resolved</span>
                  </p>
                  <ReviewCommentBody :comment="c" :editing="editOpenFor === c.id && focusedId !== c.id" :can-approve="isBuilder" :reviewers="reviewers"
                    v-model:draft="editBody" @save="saveEdit(c)" @save-send="saveEditAndSend(c)" @cancel="cancelEdit"
                    @toggle-ready="setReady(c, $event)"
                    @attach="addAttachments(c, $event)" @remove-attachment="removeAttachment(c, $event)"
                    @open="openComment(c)" @unqueue="unqueueComment(c)" />
                </div>
                <button v-if="canPost && !c.resolved && editOpenFor !== c.id" type="button"
                  class="text-gray-300 hover:text-primary"
                  v-tooltip.left="'Edit'"
                  @click="startEdit(c)">
                  <i class="pi pi-pencil text-xs" />
                </button>
                <button v-if="!c.resolved" type="button" class="text-gray-300 hover:text-emerald-600"
                  v-tooltip.left="'Resolve'"
                  @click="resolveComment(c)">
                  <i class="pi pi-check text-xs" />
                </button>
                <button v-else type="button" class="text-gray-300 hover:text-amber-500"
                  v-tooltip.left="'Reopen'"
                  @click="reopenComment(c)">
                  <i class="pi pi-undo text-xs" />
                </button>
                <button v-if="isDeveloper" type="button" class="text-gray-300 hover:text-red-500"
                  v-tooltip.left="'Delete'"
                  @click="deleteComment(c)">
                  <i class="pi pi-trash text-xs" />
                </button>
              </div>
              <div v-if="repliesByParent[c.id]?.length || replyOpenFor === c.id"
                class="ml-8 pr-2 pb-2 space-y-1.5">
                <div v-for="reply in repliesByParent[c.id] || []" :key="reply.id"
                  class="flex items-start gap-2 p-1.5 rounded-md bg-gray-50/70">
                  <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                    :style="{ background: pinColorFor(reply), color: pinTextColorFor(reply) }">
                    <i v-if="isAgentComment(reply)" class="pi pi-android text-[8px]" />
                  <template v-else>{{ initialsOf(authorLabelFor(reply)) }}</template>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] text-gray-400 mb-0.5">
                      {{ authorLabelFor(reply) }} · {{ formatRelative(reply.created_at) }}
                    </p>
                    <ReviewCommentBody :comment="reply" compact
                      @attach="addAttachments(reply, $event)"
                      @remove-attachment="removeAttachment(reply, $event)" />
                  </div>
                  <button v-if="isDeveloper" type="button" class="text-gray-300 hover:text-red-500 self-start mt-0.5"
                    v-tooltip.left="'Delete'"
                    @click="deleteComment(reply)">
                    <i class="pi pi-trash text-[10px]" />
                  </button>
                </div>
                <div v-if="replyOpenFor === c.id" class="flex flex-col gap-1">
                  <!-- The whole composer is the drop target, not just the box: you
                       cannot aim at something you can't see mid-drag. -->
                  <div class="relative"
                    @dragenter.prevent="onReplyDragEnter" @dragover.prevent="onReplyDragEnter"
                    @dragleave="replyDragOver = false" @drop.prevent="onReplyDrop">
                    <div v-if="replyDragOver"
                      class="absolute inset-0 z-10 rounded-md border-2 border-dashed border-primary bg-primary/10
                             flex items-center justify-center pointer-events-none">
                      <span class="text-[11px] font-semibold text-primary">
                        <i class="pi pi-image text-[10px] mr-1" />Drop to attach
                      </span>
                    </div>
                    <MentionTextarea v-model="replyBody" v-model:mentions="replyMentions"
                      :reviewers="reviewers" :rows="2" placeholder="Reply… @name, or drop an image" />
                  </div>
                  <div v-if="replyAttachments.length" class="flex flex-wrap gap-1.5">
                    <div v-for="(a, ai) in replyAttachments" :key="a.url" class="relative">
                      <img :src="a.url" class="w-12 h-12 object-cover rounded border border-gray-200" />
                      <button type="button" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-gray-300 text-gray-400 hover:text-red-500 flex items-center justify-center"
                        @click="replyAttachments.splice(ai, 1)"><i class="pi pi-times text-[8px]" /></button>
                    </div>
                  </div>
                  <p v-if="replyUploading" class="text-[10px] text-gray-400"><i class="pi pi-spin pi-spinner text-[9px] mr-1" />Uploading…</p>
                  <div class="flex items-center gap-2 justify-end">
                    <button type="button" class="text-[10px] text-gray-500 hover:text-gray-700"
                      @click="cancelReply">Cancel</button>
                    <Button label="Reply" size="small" outlined :disabled="!replyBody.trim() && !replyAttachments.length"
                      @click="commitReply(c)" />
                    <!-- Answer AND tell Claude to look again. A reply on its own
                         just sits in the thread; this posts it and re-sends the
                         task, so a blocked question actually gets unblocked. -->
                    <Button label="Reply &amp; send" icon="pi pi-android" size="small"
                      :disabled="!replyBody.trim() && !replyAttachments.length"
                      v-tooltip.top="'Post this reply and send the task back to Claude'"
                      @click="commitReplyAndSend(c)"
                      style="background:var(--brand-primary);border-color:var(--brand-primary)" />
                  </div>
                </div>
              </div>
              <div v-if="!c.resolved && replyOpenFor !== c.id"
                class="px-2 pb-1.5 -mt-1">
                <button type="button"
                  class="text-[10px] font-semibold text-gray-400 hover:text-primary transition-colors"
                  @click="openReply(c)">
                  <i class="pi pi-reply text-[9px]" /> Reply
                </button>
              </div>
            </div>
          </div>

          <!-- Open pinned (numbered to match on-screen pins) -->
          <p v-if="openPinned.length && visibleGeneral.length"
            class="text-[10px] font-bold uppercase tracking-wider text-gray-400 pt-2 border-t border-gray-100">
            On the page
          </p>
          <!-- The focused comment stays in the list (so pin numbers keep
               matching the page) but is dimmed — it is being worked on above. -->
          <!-- The focused comment stays in the list (so pin numbers keep
               matching the page) but is dimmed — it is being worked on above. -->
          <!-- `row.n` is the pin's number in the FULL open set, so it keeps
               matching the page when the To do / In progress tabs filter the
               list down. -->
          <div v-for="{ c, n } in openPinned" :key="c.id"
            class="rounded-lg border hover:bg-gray-50"
            :class="[
              focusedId === c.id ? 'ring-1 ring-primary opacity-50' : '',
              isSelected(c.id) ? 'border-primary bg-primary/5' : 'border-gray-100',
            ]">
            <div class="flex items-start gap-2 p-2">
              <!-- Aimed at a person → no tick, an @ marks it as theirs. -->
              <i v-if="routedToPerson(c)"
                class="pi pi-at text-[10px] text-amber-500 mt-2 shrink-0"
                v-tooltip.left="`For ${mentionNames(c)} — not sent to Claude`" />
              <input v-else type="checkbox" class="accent-primary w-3 h-3 mt-2 shrink-0 cursor-pointer"
                :disabled="!c.ready"
                :class="c.ready ? '' : 'opacity-30 cursor-not-allowed'"
                v-tooltip.left="c.ready ? 'Include when sending tasks to Claude' : 'Mark ready before sending'"
                :checked="isSelected(c.id)" @change="toggleSelected(c.id)" />
              <!-- The number is the handle: clicking it focuses the comment at
                   the top of the panel, same as clicking its pin on the page.
                   Scoped to the badge rather than the whole row so it can't
                   fire from the tick box or the action buttons. -->
              <button type="button"
                class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5
                       hover:ring-2 hover:ring-primary/40 transition-shadow"
                v-tooltip.left="'Open this comment'"
                :style="{ background: pinColorFor(c), color: pinTextColorFor(c) }"
                @mouseenter="hoverPinId = c.id" @mouseleave="hoverPinId = null"
                @click="openComment(c)">
                {{ n }}
              </button>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] text-gray-400 mb-0.5">
                  {{ authorLabelFor(c) }} · {{ formatRelative(c.created_at) }}
                </p>
                <ReviewCommentBody :comment="c" :editing="editOpenFor === c.id && focusedId !== c.id" :can-approve="isBuilder" :reviewers="reviewers"
                  v-model:draft="editBody" @save="saveEdit(c)" @save-send="saveEditAndSend(c)" @cancel="cancelEdit"
                  @toggle-ready="setReady(c, $event)"
                    @attach="addAttachments(c, $event)" @remove-attachment="removeAttachment(c, $event)"
                    @open="openComment(c)" @unqueue="unqueueComment(c)" />
              </div>
              <button v-if="canPost && editOpenFor !== c.id" type="button"
                class="text-gray-300 hover:text-primary"
                v-tooltip.left="'Edit'"
                @click="startEdit(c)">
                <i class="pi pi-pencil text-xs" />
              </button>
              <button type="button" class="text-gray-300 hover:text-emerald-600"
                v-tooltip.left="'Resolve'"
                @click="resolveComment(c)">
                <i class="pi pi-check text-xs" />
              </button>
              <button v-if="isDeveloper" type="button" class="text-gray-300 hover:text-red-500"
                v-tooltip.left="'Delete'"
                @click="deleteComment(c)">
                <i class="pi pi-trash text-xs" />
              </button>
            </div>
            <!-- Replies + reply composer -->
            <div v-if="repliesByParent[c.id]?.length || replyOpenFor === c.id"
              class="ml-8 pr-2 pb-2 space-y-1.5">
              <div v-for="reply in repliesByParent[c.id] || []" :key="reply.id"
                class="flex items-start gap-2 p-1.5 rounded-md bg-gray-50/70">
                <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                  :style="{ background: pinColorFor(reply), color: pinTextColorFor(reply) }">
                  <i v-if="isAgentComment(reply)" class="pi pi-android text-[8px]" />
                  <template v-else>{{ initialsOf(authorLabelFor(reply)) }}</template>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] text-gray-400 mb-0.5">
                    {{ authorLabelFor(reply) }} · {{ formatRelative(reply.created_at) }}
                  </p>
                  <ReviewCommentBody :comment="reply" compact
                      @attach="addAttachments(reply, $event)"
                      @remove-attachment="removeAttachment(reply, $event)" />
                </div>
                <button v-if="isDeveloper" type="button" class="text-gray-300 hover:text-red-500 self-start mt-0.5"
                  v-tooltip.left="'Delete'"
                  @click="deleteComment(reply)">
                  <i class="pi pi-trash text-[10px]" />
                </button>
              </div>
              <div v-if="replyOpenFor === c.id" class="flex flex-col gap-1">
                <!-- The whole composer is the drop target, not just the box: you
                     cannot aim at something you can't see mid-drag. -->
                <div class="relative"
                  @dragenter.prevent="onReplyDragEnter" @dragover.prevent="onReplyDragEnter"
                  @dragleave="replyDragOver = false" @drop.prevent="onReplyDrop">
                  <div v-if="replyDragOver"
                    class="absolute inset-0 z-10 rounded-md border-2 border-dashed border-primary bg-primary/10
                           flex items-center justify-center pointer-events-none">
                    <span class="text-[11px] font-semibold text-primary">
                      <i class="pi pi-image text-[10px] mr-1" />Drop to attach
                    </span>
                  </div>
                  <MentionTextarea v-model="replyBody" v-model:mentions="replyMentions"
                    :reviewers="reviewers" :rows="2" placeholder="Reply… @name, or drop an image" />
                </div>
                  <div v-if="replyAttachments.length" class="flex flex-wrap gap-1.5">
                    <div v-for="(a, ai) in replyAttachments" :key="a.url" class="relative">
                      <img :src="a.url" class="w-12 h-12 object-cover rounded border border-gray-200" />
                      <button type="button" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-gray-300 text-gray-400 hover:text-red-500 flex items-center justify-center"
                        @click="replyAttachments.splice(ai, 1)"><i class="pi pi-times text-[8px]" /></button>
                    </div>
                  </div>
                  <p v-if="replyUploading" class="text-[10px] text-gray-400"><i class="pi pi-spin pi-spinner text-[9px] mr-1" />Uploading…</p>
                <div class="flex items-center gap-2 justify-end">
                  <button type="button" class="text-[10px] text-gray-500 hover:text-gray-700"
                    @click="cancelReply">Cancel</button>
                  <Button label="Reply" size="small" outlined :disabled="!replyBody.trim() && !replyAttachments.length"
                    @click="commitReply(c)" />
                  <!-- Answer AND tell Claude to look again — see the other footer. -->
                  <Button label="Reply &amp; send" icon="pi pi-android" size="small"
                    :disabled="!replyBody.trim() && !replyAttachments.length"
                    v-tooltip.top="'Post this reply and send the task back to Claude'"
                    @click="commitReplyAndSend(c)"
                    style="background:var(--brand-primary);border-color:var(--brand-primary)" />
                </div>
              </div>
            </div>
            <div v-if="replyOpenFor !== c.id"
              class="px-2 pb-1.5 -mt-1">
              <button type="button"
                class="text-[10px] font-semibold text-gray-400 hover:text-primary transition-colors"
                @click="openReply(c)">
                <i class="pi pi-reply text-[9px]" /> Reply
              </button>
            </div>
          </div>

          <!-- Resolved pinned — listed without numbers since they're no longer on the screen -->
          <div v-if="resolvedPinned.length" class="pt-2 border-t border-gray-100 space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Resolved</p>
            <div v-for="c in resolvedPinned" :key="c.id"
              class="rounded-lg border border-gray-100 hover:bg-gray-50 opacity-60">
              <div class="flex items-start gap-2 p-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 bg-gray-300 text-gray-600">
                  <i class="pi pi-check text-[10px]" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] text-gray-400 mb-0.5">
                    {{ authorLabelFor(c) }} · {{ formatRelative(c.created_at) }}
                    <span class="ml-1 text-emerald-600 font-semibold">· Resolved</span>
                  </p>
                  <p class="text-xs text-gray-700 whitespace-pre-wrap break-words line-through">{{ c.body }}</p>
                </div>
                <button type="button" class="text-gray-300 hover:text-amber-500"
                  v-tooltip.left="'Reopen'"
                  @click="reopenComment(c)">
                  <i class="pi pi-undo text-xs" />
                </button>
                <button v-if="isDeveloper" type="button" class="text-gray-300 hover:text-red-500"
                  v-tooltip.left="'Delete'"
                  @click="deleteComment(c)">
                  <i class="pi pi-trash text-xs" />
                </button>
              </div>
              <div v-if="repliesByParent[c.id]?.length" class="ml-8 pr-2 pb-2 space-y-1.5">
                <div v-for="reply in repliesByParent[c.id]" :key="reply.id"
                  class="flex items-start gap-2 p-1.5 rounded-md bg-gray-50/70">
                  <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                    :style="{ background: pinColorFor(reply), color: pinTextColorFor(reply) }">
                    <i v-if="isAgentComment(reply)" class="pi pi-android text-[8px]" />
                  <template v-else>{{ initialsOf(authorLabelFor(reply)) }}</template>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] text-gray-400 mb-0.5">
                      {{ authorLabelFor(reply) }} · {{ formatRelative(reply.created_at) }}
                    </p>
                    <ReviewCommentBody :comment="reply" compact
                      @attach="addAttachments(reply, $event)"
                      @remove-attachment="removeAttachment(reply, $event)" />
                  </div>
                  <button v-if="isDeveloper" type="button" class="text-gray-300 hover:text-red-500 self-start mt-0.5"
                    v-tooltip.left="'Delete'"
                    @click="deleteComment(reply)">
                    <i class="pi pi-trash text-[10px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>


          <!-- New page-level comment -->
          <div class="pt-2 border-t border-gray-100">
            <MentionTextarea v-model="newGeneralBody" :reviewers="reviewers" :rows="2"
              placeholder="Page-level comment… @name to ask someone" />
            <div class="flex justify-end mt-1">
              <Button label="Post" size="small" :disabled="!newGeneralBody.trim()"
                @click="postGeneral"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </div>
        </div>
      </div>

      <!-- SIGN-OFFS panel — per-reviewer approval list for the current page -->
      <!-- ALL — the whole backlog, every page. Grouped by page, busiest first,
           because "where is the work" is the first question a queue answers. -->
      <div v-else-if="panel === 'all'" class="flex-1 overflow-y-auto">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex-1">
            All open tasks
          </p>
          <button type="button" class="text-[10px] text-gray-400 hover:text-primary"
            v-tooltip.left="'Refresh'" @click="loadAllTasks">
            <i class="pi pi-refresh text-[10px]" />
          </button>
        </div>

        <p v-if="loadingAll" class="text-xs text-gray-400 py-6 text-center">
          <i class="pi pi-spin pi-spinner text-xs mr-1" />Loading…
        </p>
        <p v-else-if="!allTasks.length" class="text-xs text-gray-400 py-6 text-center">
          Nothing outstanding anywhere. 🎉
        </p>

        <div v-else class="px-4 py-3 space-y-4">
          <!-- Send the WHOLE backlog in one go. The per-page Send only ever
               covered the page you were on, so a queue built up across screens
               had no single way out. -->
          <div class="flex items-center gap-2">
            <Button :label="`Send all ${allTasks.filter((t) => t.ready).length} to Claude`"
              icon="pi pi-android" size="small" class="flex-1" :loading="briefing"
              :disabled="!allTasks.some((t) => t.ready)"
              @click="sendAllTasks"
              style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>
          <p v-if="briefResult" class="text-[11px] text-emerald-700 -mt-2">
            <i class="pi pi-check-circle text-[10px]" />
            {{ briefResult.taskCount }} written to <code class="bg-emerald-50 px-1 rounded">{{ briefResult.file }}</code>
          </p>

          <div v-for="grp in allTasksByPage" :key="grp.path">
            <div class="flex items-center gap-2 mb-1.5">
              <code class="text-[10px] text-gray-500 truncate flex-1">{{ grp.path }}</code>
              <span class="text-[10px] font-bold text-gray-400">{{ grp.items.length }}</span>
              <button v-if="grp.path === pageKey" type="button"
                class="text-[10px] font-semibold text-primary hover:underline"
                @click="panel = 'page'">Open</button>
              <button v-else-if="mentionPathNavigable(grp.path)" type="button"
                class="text-[10px] font-semibold text-primary hover:underline"
                @click="goToMention({ path: grp.path })">Go →</button>
            </div>
            <div class="space-y-1">
              <!-- Each task is a link to the thing it's about: same page →
                   focus its pin, another page → go there. A backlog you can
                   only read is half a backlog. A templated path (/events/:id)
                   names a screen but not a record, so those aren't clickable —
                   the id was never stored, and a link that 404s is worse than
                   no link. -->
              <button v-for="t in grp.items" :key="t.id" type="button"
                class="w-full text-left flex items-start gap-2 rounded-md border border-gray-100 px-2 py-1.5 transition-colors"
                :class="taskNavigable(t) ? 'hover:bg-primary/5 hover:border-primary/30 cursor-pointer' : 'cursor-default'"
                :title="taskNavigable(t) ? 'Show me this' : 'On a record page — open that record to see it'"
                @click="openTask(t)">
                <span class="text-[10px] font-bold text-gray-400 mt-0.5 w-5 shrink-0">
                  {{ t.seq != null ? `#${t.seq}` : '' }}
                </span>
                <p class="flex-1 min-w-0 text-xs text-gray-700 break-words">{{ t.body }}</p>
                <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                  :class="taskState(t).cls">{{ taskState(t).label }}</span>
                <i v-if="taskNavigable(t)" class="pi pi-angle-right text-[10px] text-gray-300 mt-0.5 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="panel === 'signoffs'" class="flex-1 overflow-y-auto">
        <div class="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Sign-offs</p>
          <span class="text-[10px] font-semibold"
            :class="signedCount === reviewers.length && reviewers.length > 0 ? 'text-emerald-600' : 'text-gray-400'">
            {{ signedCount }} / {{ reviewers.length }} signed
          </span>
        </div>
        <p v-if="!reviewers.length" class="text-xs text-gray-400 py-6 text-center">No reviewers yet.</p>
        <div v-else class="px-4 py-3 space-y-1.5">
          <div v-for="r in reviewers" :key="r.id"
            class="flex items-center gap-2 px-2 py-2 rounded-md bg-gray-50">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              :style="{ background: (r.color || '#1E2157') + '22', color: r.color || '#1E2157' }">
              {{ initialsOf(r.name) }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-gray-800 truncate">
                {{ r.name }}
                <span v-if="r.id === meReviewer?.id" class="ml-1 text-[9px] font-bold uppercase tracking-wider text-primary">You</span>
              </p>
              <p v-if="r.role" class="text-[10px] text-gray-400 truncate">{{ r.role }}</p>
            </div>
            <template v-if="signoffsByReviewer[r.id]">
              <button v-if="r.id === meReviewer?.id" type="button"
                class="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:text-red-600 transition-colors"
                v-tooltip.left="'Click to revoke'"
                @click="revokeSignoff(r)">
                <i class="pi pi-check-circle text-xs" />
                {{ formatRelative(signoffsByReviewer[r.id].signed_at) }}
              </button>
              <span v-else class="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                <i class="pi pi-check-circle text-xs" />
                {{ formatRelative(signoffsByReviewer[r.id].signed_at) }}
              </span>
            </template>
            <button v-else-if="r.id === meReviewer?.id" type="button"
              class="px-3 py-1.5 text-[11px] font-semibold rounded-md text-white"
              style="background:#10b981"
              @click="signOff(r)">
              Sign off
            </button>
            <span v-else class="text-[10px] text-gray-400 italic">Pending</span>
          </div>
        </div>
      </div>

    </div>
    </Teleport>
  </div>

  <!-- NB there are deliberately NO comment dialogs — neither to write one nor to
       read one. A modal covers the exact thing the pin points at, so you could
       look at the note or the screen but never both, and the pin overlay (which
       has to out-rank wizard modals) ended up drawn on top of the dialog's own
       buttons. Writing happens in the composer at the top of the docked panel,
       reading in the focused card just below it — page stays visible in both. -->
</template>

<script setup lang="ts">
// Explicit (not relying on the utils/ auto-import) because the TYPE is needed
// too, and because this module is deliberately standalone so it can be lifted
// into a browser extension later — an explicit path documents that.
import { describeElement, resolveTargetElement, describeTargetLine, type ReviewTarget } from '~/utils/reviewTarget'

const route = useRoute()
const reviews = useReviewsApi()
const user = useSupabaseUser()
const { orgId } = useOrg()
const { isDeveloper } = useDeveloperGate()

// Default reviewers seeded the first time the widget opens against an
// org with no reviewer rows. The user listed these explicitly when
// asking for the sign-off feature.
const DEFAULT_REVIEWERS = [
  { name: 'Karl',     role: 'Builder',  color: '#1E2157', sort_order: 0 },
  { name: 'Kate',     role: 'PM',       color: '#3b82f6', sort_order: 1 },
  { name: 'Rodd',     role: 'CEO',      color: '#8b5cf6', sort_order: 2 },
  { name: 'Jade',     role: 'Team',     color: '#ec4899', sort_order: 3 },
  { name: 'Shontell', role: 'Team',     color: '#14b8a6', sort_order: 4 },
  { name: 'Jono',     role: 'Customer', color: '#f97316', sort_order: 5 },
]

const stages = [
  { value: 'draft',     label: 'Draft',     activeBg: 'bg-gray-500'    },
  { value: 'in_review', label: 'In review', activeBg: 'bg-amber-500'   },
  { value: 'approved',  label: 'Approved',  activeBg: 'bg-emerald-500' },
]
function stageLabelFor(s: string) {
  return stages.find(x => x.value === s)?.label ?? 'Draft'
}
function stageChipFor(s: string) {
  if (s === 'approved')  return 'bg-emerald-100 text-emerald-700'
  if (s === 'in_review') return 'bg-amber-100 text-amber-800'
  return 'bg-gray-200 text-gray-700'
}
const stageLabel = computed(() => stageLabelFor(review.value?.stage || 'draft'))
const stageChip  = computed(() => stageChipFor(review.value?.stage || 'draft'))

// Each tab on a page should have its own approval state. Tabs across the
// app live in `?tab=` query params, so the storage key is path + ?tab=
// when present. We key on the **route pattern** (e.g. `/activities/:id`)
// rather than the raw path, so dynamic instances collapse into a single
// "page" — reviewers approve the screen, not the row of data behind it.
const pageKey = computed(() => {
  const matched = route.matched[route.matched.length - 1]
  const base = matched?.path || route.path
  const tab = route.query.tab
  return tab ? `${base}?tab=${tab}` : base
})
const props = defineProps<{ hidePill?: boolean }>()
// Open state is shared so an external trigger (the left icon-rail comment
// button) can pop the panel open. `hidePill` hides the compact inline pill
// when the widget is driven purely from that external trigger.
const expanded = useReviewPanel()
// On-screen pin visibility. Persisted in localStorage so demoing or
// presenting doesn't require flipping it every reload. Doesn't affect
// the comment list inside the panel — only the coloured overlay pins.
const pinsVisible = ref(true)
const PINS_VISIBLE_KEY = 'review_pins_visible'
onMounted(() => {
  const v = localStorage.getItem(PINS_VISIBLE_KEY)
  if (v !== null) pinsVisible.value = v === '1'
})
watch(pinsVisible, (v) => { localStorage.setItem(PINS_VISIBLE_KEY, v ? '1' : '0') })

const panel = ref<'page' | 'signoffs' | 'all'>('page')

// ── The whole backlog, across every page ─────────────────────────────
const allTasks = ref<any[]>([])
const loadingAll = ref(false)
async function loadAllTasks() {
  if (!orgId.value) { allTasks.value = []; return }
  loadingAll.value = true
  try {
    const rows = await reviews.allOpenComments(orgId.value)
    // Replies hang off their parents; the backlog is a list of TASKS.
    allTasks.value = rows.filter((c: any) => !c.parent_id)
  } catch {
    allTasks.value = []
  } finally {
    loadingAll.value = false
  }
}
watch([panel, orgId], () => { if (panel.value === 'all') loadAllTasks() }, { immediate: true })

/** Grouped by page, busiest first — the shape of the backlog at a glance. */
const allTasksByPage = computed(() => {
  const by = new Map<string, any[]>()
  for (const c of allTasks.value) {
    const list = by.get(c.path) ?? []
    list.push(c)
    by.set(c.path, list)
  }
  return [...by.entries()]
    .map(([path, items]) => ({ path, items: items.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)) }))
    .sort((a, b) => b.items.length - a.items.length)
})

/** Can we actually reach the page this task is on? (see mentionPathNavigable) */
function taskNavigable(t: any) { return t.path === pageKey.value || mentionPathNavigable(t.path) }

/**
 * Open the thing a task is about. Already on its page → focus the comment so
 * its pin lights up on screen; otherwise navigate there, remembering which
 * comment to focus once the page has loaded.
 */
function openTask(t: any) {
  if (t.path === pageKey.value) {
    panel.value = 'page'
    openComment(t)
    return
  }
  if (!mentionPathNavigable(t.path)) return
  pendingFocusId.value = t.id
  navigateTo(t.path.split('?')[0])
}

/**
 * A comment to focus once the destination page has loaded its own comments.
 * Navigation swaps pageKey and reloads the bundle, so the focus has to survive
 * that round trip rather than being applied against the old page's list.
 */
const pendingFocusId = ref<string | null>(null)

/** Status of one task, for the chip in the all-tasks list. */
function taskState(c: any): { label: string; cls: string } {
  if (c.claude_status === 'done') return { label: 'Built', cls: 'bg-emerald-100 text-emerald-700' }
  if (c.claude_status === 'needs_info') return { label: 'Needs info', cls: 'bg-red-100 text-red-700' }
  if (c.claude_status === 'queued') return { label: 'Queued', cls: 'bg-sky-100 text-sky-700' }
  if (!c.ready) return { label: 'Suggestion', cls: 'bg-slate-100 text-slate-600' }
  return { label: 'To do', cls: 'bg-gray-100 text-gray-600' }
}
const panelTabs: { value: 'page' | 'signoffs' | 'all'; label: string }[] = [
  { value: 'page',     label: 'This page' },
  { value: 'signoffs', label: 'Sign-offs' },
  // The whole backlog. The panel is page-scoped by design, which meant the
  // total outstanding work was visible nowhere — a task queued from another
  // screen simply didn't exist until you wandered back onto that page.
  { value: 'all',      label: 'All' },
]

const review = ref<any | null>(null)
const comments = ref<any[]>([])
const reviewers = ref<any[]>([])
const signoffsForPage = ref<any[]>([])


// Top-level comments (parent_id null) — replies are nested under their parent.
const topLevel = computed(() => comments.value.filter(c => !c.parent_id))
const replies  = computed(() => comments.value.filter(c => !!c.parent_id))
const repliesByParent = computed<Record<string, any[]>>(() => {
  const out: Record<string, any[]> = {}
  for (const r of replies.value) {
    if (!out[r.parent_id]) out[r.parent_id] = []
    out[r.parent_id].push(r)
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
  }
  return out
})

// Pins drawn on the page itself — resolved ones are removed entirely so
// the screen stays clean once feedback has been actioned. Replies never
// get pins; they hang off the parent in the list.
const screenPins = computed(() => {
  // The pins on the page mirror the LIST beside them — same tab filter, same
  // set. They used to ignore the tab entirely, so with "In progress" selected
  // the panel listed one set of numbers while the page showed a different set
  // of pins; the two looked like they disagreed about numbering when really
  // they were showing different comments.
  // (Resolved pins stay off the page: matchesFilter demands `resolved` on that
  // tab, so nothing is drawn there — the screen stays clean once feedback has
  // been actioned, which is the behaviour that was always intended.)
  return topLevel.value.filter(c => c.x != null && c.y != null && !c.resolved && matchesFilter(c))
})
// Pinned comments still shown in the list. Split into open (numbered to
// match on-screen pins) and resolved (no number, may be hidden via the
// toggle) so list ordering matches what the user sees on the page.
/**
 * TO DO vs IN PROGRESS.
 *
 * Once a comment has been handed over it shouldn't sit in the list you're still
 * working down — but it can't just vanish either, because "built, awaiting your
 * sign-off" is exactly where Karl needs to look. So handed-over comments move to
 * their own tab: anything Claude has touched (queued / built / asked about).
 */
const taskFilter = ref<'todo' | 'inprogress' | 'resolved'>('todo')
const isHandedOver = (c: any) => !!c.claude_status
function matchesFilter(c: any) {
  if (taskFilter.value === 'resolved') return !!c.resolved
  if (c.resolved) return false
  return taskFilter.value === 'inprogress' ? isHandedOver(c) : !isHandedOver(c)
}
const todoCount = computed(() =>
  comments.value.filter(c => !c.resolved && !c.parent_id && !isHandedOver(c)).length)
const inProgressCount = computed(() =>
  comments.value.filter(c => !c.resolved && !c.parent_id && isHandedOver(c)).length)
const resolvedCount = computed(() =>
  comments.value.filter(c => c.resolved && !c.parent_id).length)

/**
 * The number shown against each comment is its stored `seq` — permanent for the
 * life of the page. Filtering by tab, resolving something, or a pin being
 * undrawable all leave it untouched, so the panel and the page always agree and
 * "pin 7" keeps meaning pin 7.
 */
// screenPins already applies the tab filter, so this is a straight map — the
// list and the pins are literally the same set, which is the point.
const openPinned = computed(() =>
  screenPins.value.map((c, i) => ({ c, n: c.seq ?? i + 1 })))
// Resolved pins live on their own tab now — they're history, not work, and
// mixing them into the working list is what the old "Hide resolved" checkbox
// was awkwardly trying to undo.
const resolvedPinned = computed(() => {
  if (taskFilter.value !== 'resolved') return []
  return topLevel.value.filter(c => c.x != null && c.y != null && c.resolved)
})
const visibleGeneral = computed(() => {
  return topLevel.value
    .filter(c => c.x == null || c.y == null)
    .filter(c => matchesFilter(c))
})
const openCount = computed(() => comments.value.filter(c => !c.resolved).length)
// Publish the open count so the left-rail trigger can show a live badge.
const sharedReviewCount = useReviewCount()
watch(openCount, v => { sharedReviewCount.value = v }, { immediate: true })

const signoffsByReviewer = computed<Record<string, any>>(() => {
  const out: Record<string, any> = {}
  for (const s of signoffsForPage.value) out[s.reviewer_id] = s
  return out
})
const signedCount = computed(() => signoffsForPage.value.length)

// Identity is locked to the logged-in user. We match by the email's
// local part against `reviewer.name` (case-insensitive); if no match we
// have no profile and commenting/sign-off is disabled. There's
// deliberately no "post as someone else" affordance.
const meReviewer = computed(() => {
  const email = user.value?.email
  if (!email || !reviewers.value.length) return null
  const local = email.split('@')[0]?.toLowerCase()
  return reviewers.value.find(r => (r.name || '').toLowerCase() === local) ?? null
})
// Aliases used throughout the rest of the script — keep the existing
// names so insert payloads and helpers don't need to change.
const activeReviewer = computed(() => meReviewer.value)
const activeReviewerId = computed(() => meReviewer.value?.id ?? null)
const authorName = computed(() => meReviewer.value?.name ?? user.value?.email ?? null)
const canPost = computed(() => !!meReviewer.value)
// Stage is build-driven, not consensus-driven — only the builder (Karl)
// flips the lifecycle. Everyone else contributes via sign-offs.
const isBuilder = computed(() => meReviewer.value?.name === 'Karl')
const canEditStage = isBuilder
// The builder's own comments are work by definition and skip the ready gate;
// everyone else's are suggestions until he approves them.
const postsReady = isBuilder

// Click handler for the dock's quick-add icon — toggles pin mode if the
// logged-in user has a reviewer profile, otherwise no-op.
function quickPin() {
  if (pinning.value) { togglePinning(); return }
  if (!canPost.value) return
  togglePinning()
}

// ── Pin colour resolution — falls back through cached reviewer, named
// reviewer match, then a default amber for legacy comments.
function reviewerForComment(c: any): any | null {
  if (c.reviewer_id) {
    const r = reviewers.value.find(rv => rv.id === c.reviewer_id)
    if (r) return r
  }
  if (c.author_name) {
    const r = reviewers.value.find(rv => rv.name === c.author_name)
    if (r) return r
  }
  return null
}
/** Replies the agent wrote — its questions land in the thread as real replies. */
const AGENT_AUTHOR = 'Claude'
const isAgentComment = (c: any) => c?.author_name === AGENT_AUTHOR

function pinColorFor(c: any): string {
  // The agent isn't a reviewer, so it has no palette colour — give it a
  // distinct slate rather than the unassigned-author amber, which would read
  // as "someone we don't recognise" on every question it asks.
  if (isAgentComment(c)) return '#334155'
  return reviewerForComment(c)?.color || '#fbbf24'
}
function pinTextColorFor(c: any): string {
  // White text on most palette colours, dark text on the amber default.
  if (isAgentComment(c)) return '#ffffff'
  return reviewerForComment(c) ? '#ffffff' : '#111827'
}
function authorLabelFor(c: any): string {
  return reviewerForComment(c)?.name || c.author_name || 'Unknown'
}

// ── Reviewers — load + auto-seed on first use ────────────────────────
async function loadReviewers() {
  if (!orgId.value) return
  // Seeds the DEFAULT set server-side the first time (idempotent) and returns
  // the resolved list either way.
  reviewers.value = await reviews.ensureReviewers(
    orgId.value,
    DEFAULT_REVIEWERS.map(r => ({ name: r.name, role: r.role, color: r.color, sortOrder: r.sort_order })),
  )
}

// Create a reviewer profile for the signed-in user so they can comment / sign off.
// meReviewer matches the email's local part against reviewer.name, so we name the
// row after that (capitalised for display — matching is case-insensitive).
const creatingReviewer = ref(false)
async function createMyReviewer() {
  const email = user.value?.email
  if (!email || !orgId.value || creatingReviewer.value) return
  creatingReviewer.value = true
  const local = email.split('@')[0]
  const name = local.charAt(0).toUpperCase() + local.slice(1)
  const colors = ['#1E2157', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
  await reviews.createReviewer(
    orgId.value, name, 'Admin',
    colors[reviewers.value.length % colors.length],
    reviewers.value.length,
  )
  await loadReviewers()
  creatingReviewer.value = false
}

// ── Per-page load: review row + comments + sign-offs for current pageKey ─
async function load() {
  if (!orgId.value) return
  const key = pageKey.value
  const bundle = await reviews.pageBundle(orgId.value, key)
  review.value = bundle.review
  comments.value = bundle.comments
  signoffsForPage.value = bundle.signoffs
  // Arriving from a click in the All tab: focus the comment that sent us here,
  // now its page's comments actually exist. Cleared either way, so a stale
  // target can't hijack a later, unrelated page load.
  if (pendingFocusId.value) {
    const target = comments.value.find(c => c.id === pendingFocusId.value)
    pendingFocusId.value = null
    if (target) {
      panel.value = 'page'
      openComment(target)
    }
  }
}
watch([orgId, pageKey], load, { immediate: true })
watch(orgId, loadReviewers, { immediate: true })

// ── Stage transitions ────────────────────────────────────────────────
// Manual stage changes are gated by canEditStage (UI hides the toggle).
// Auto-promotions (first comment → in_review, all-signed → approved,
// revoke-on-approved → in_review) still call this helper from the
// internal flows — the auto path is always allowed.
async function setStage(stage: string) {
  if (!orgId.value) return
  // The repo upserts by (org, path) and owns the approved_by/at bookkeeping.
  review.value = await reviews.setStage(orgId.value, pageKey.value, stage, user.value?.id ?? null)
}

// ── Sign-offs (per reviewer) ─────────────────────────────────────────
async function signOff(r: any) {
  if (!orgId.value) return
  // Defence-in-depth: the only sign-off button rendered is the one for
  // the logged-in user. Reject any other case anyway.
  if (!meReviewer.value || r.id !== meReviewer.value.id) return
  const data = await reviews.createSignoff(orgId.value, pageKey.value, r.id, user.value?.id ?? null)
  if (data) signoffsForPage.value.push(data)
  // Auto-promote stage when all reviewers have signed.
  if (signoffsForPage.value.length === reviewers.value.length && reviewers.value.length > 0) {
    if ((review.value?.stage || 'draft') !== 'approved') await setStage('approved')
  }
}
async function revokeSignoff(r: any) {
  const existing = signoffsByReviewer.value[r.id]
  if (!existing) return
  await reviews.deleteSignoff(existing.id)
  signoffsForPage.value = signoffsForPage.value.filter(s => s.id !== existing.id)
  // If the page had been auto-approved, drop it back to in_review.
  if ((review.value?.stage || 'draft') === 'approved') await setStage('in_review')
}

// ── Pinning flow ─────────────────────────────────────────────────────
const mainEl = ref<HTMLElement | null>(null)
const pinning = ref(false)
const cursor = ref<{ x: number; y: number } | null>(null)
const composeOpen = ref(false)
const composeBody = ref('')
const composeCoords = ref<ClickAnchor | null>(null)
const composeInput = ref<{ focus: () => void } | null>(null)
/** Reviewer ids named in the draft (@kate), kept in step by <MentionTextarea>. */
const composeMentions = ref<string[]>([])

// Images dropped while writing a NEW comment. Uploaded straight away; attached
// once the comment row exists, since nothing can hang off it before then.
const composeAttachments = ref<{ url: string; name: string }[]>([])
const composeDragOver = ref(false)
const composeUploading = ref(false)
const { uploadFile: uploadComposeFile } = useUpload()
function onComposeDragEnter(e: DragEvent) {
  if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) composeDragOver.value = true
}
async function onComposeDrop(e: DragEvent) {
  composeDragOver.value = false
  const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
  if (!files.length) return
  composeUploading.value = true
  try {
    for (const f of files) {
      try {
        const { url } = await uploadComposeFile(f)
        if (url) composeAttachments.value.push({ url, name: f.name })
      } catch { /* one bad file shouldn't discard the others */ }
    }
  } finally {
    composeUploading.value = false
  }
}

/**
 * Reviewer ids named in a piece of text. Used when text is edited outside a
 * <MentionTextarea> (the edit box), so removing an @name removes the mention
 * too rather than leaving someone attached to a comment that no longer asks
 * them anything.
 */
function deriveMentions(text: string): string[] {
  const ids: string[] = []
  for (const r of reviewers.value) {
    const name = String(r.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (name && new RegExp(`(?:^|\\s)@${name}\\b`, 'i').test(text)) ids.push(r.id)
  }
  return ids
}
/** What the pending pin landed on — shown before posting, so a bad hit is visible. */
const composeWhere = computed(() => describeTargetLine(composeCoords.value?.context))
/**
 * Carries a half-written note across a re-place. Landing a pin normally clears
 * the box; re-placing must not, or fixing your aim costs you what you'd typed.
 */
const preservedBody = ref('')
/** Not happy with where it landed? Go straight back into pin mode. */
function replacePin() {
  preservedBody.value = composeBody.value
  composeOpen.value = false
  composeCoords.value = null
  if (!pinning.value) togglePinning()
}

/**
 * Where the PENDING pin will land, in viewport coords. Resolved from its
 * captured element (same path the saved pins use) so it tracks scrolling
 * instead of freezing at the click point.
 */
const pendingPinPos = computed(() => {
  void viewportTick.value
  const ctx = composeCoords.value?.context
  if (!composeOpen.value || !ctx) return null
  const el = resolveTargetElement(ctx)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { left: r.left + (ctx.offsetX ?? 0.5) * r.width, top: r.top + (ctx.offsetY ?? 0.5) * r.height }
})

function findMainEl() {
  const el = document.querySelector('main') as HTMLElement | null
  if (mainEl.value === el) return
  // Detach old scroll listener first
  if (mainEl.value) mainEl.value.removeEventListener('scroll', onMainScroll)
  mainEl.value = el
  if (el) el.addEventListener('scroll', onMainScroll, { passive: true })
}
function onMainScroll() { viewportTick.value++ }
function onWindowResize() { viewportTick.value++ }

// Watch the document for dialog open/close so dialog-anchored pins
// re-render when their host appears or disappears. Body subtree is
// where PrimeVue Teleports its dialogs.
let bodyObserver: MutationObserver | null = null
onMounted(() => {
  findMainEl()
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', onWindowResize)
  bodyObserver = new MutationObserver(() => { viewportTick.value++ })
  bodyObserver.observe(document.body, { childList: true, subtree: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onWindowResize)
  if (mainEl.value) mainEl.value.removeEventListener('scroll', onMainScroll)
  if (bodyObserver) { bodyObserver.disconnect(); bodyObserver = null }
  setPinningCursor(false)
})
watch(pageKey, () => nextTick(findMainEl))

// Forces re-projection of pin positions on main scroll + window resize.
// Cheap to bump; the computed below reads it.
const viewportTick = ref(0)

// Pins live in DB as anchor-relative coords. At render time we project
// each pin into viewport space using its anchor's current position:
//   - anchor_selector = null → main's scroll content (default)
//   - anchor_selector = "dialog:<id>" → a [role=dialog] / .p-dialog
//     whose header text matches <id>; only rendered while that dialog
//     is on screen, so closing the modal hides the pin and reopening
//     restores it in the same spot.
// Triggered to re-evaluate on scroll, resize, and dialog open/close
// (see the MutationObserver in onMounted).
// True while any PrimeVue modal is up. Recomputed off the same viewportTick
// the body MutationObserver bumps, so it tracks dialog open/close.
const modalOpen = computed(() => {
  void viewportTick.value
  if (typeof document === 'undefined') return false
  // .app-modal-overlay = a page rendered as a modal (e.g. the event wizards),
  // which covers the header trigger just like a PrimeVue mask does.
  return !!document.querySelector('.p-dialog-mask, .app-modal-overlay')
})

const screenPinPositions = computed(() => {
  void viewportTick.value
  // `n` is the comment's PERMANENT number (page_comments.seq), not a position.
  // It was the render-loop index, which was wrong twice over: the loop skips
  // pins it can't currently draw (so the page disagreed with the panel), and
  // resolving a comment renumbered everything after it (so "pin 7" stopped
  // meaning the same thing tomorrow). Both go away once the number is stored.
  const out: { pin: any; n: number; left: number; top: number }[] = []
  const mainRect = mainEl.value?.getBoundingClientRect()
  const sx = mainEl.value?.scrollLeft ?? 0
  const sy = mainEl.value?.scrollTop ?? 0
  for (const [idx, c] of screenPins.value.entries()) {
    // Fall back to position only for rows created before seq existed.
    const n = c.seq ?? idx + 1
    // 1. ELEMENT anchor (preferred). A pin that knows which element it points
    //    at is drawn from that element's live rect, so it rides window resize,
    //    reflow and content shifting above it — the stored (x, y) can only ever
    //    be right at the width it was captured at. Comments made before context
    //    capture existed have no `context` and fall through to the old paths.
    const target = c.context ? resolveTargetElement(c.context as any) : null
    if (target) {
      const r = target.getBoundingClientRect()
      // No box = the element is hidden (collapsed section, inactive wizard
      // step, closed tab). Hide the pin with it rather than stranding it at
      // 0,0 — it comes back when its element does.
      if (r.width === 0 && r.height === 0) continue
      const ox = typeof c.context.offsetX === 'number' ? c.context.offsetX : 0.5
      const oy = typeof c.context.offsetY === 'number' ? c.context.offsetY : 0.5
      out.push({ pin: c, n, left: r.left + ox * r.width, top: r.top + oy * r.height })
      continue
    }
    if (c.anchor_selector) {
      const dialog = findDialogByAnchor(c.anchor_selector)
      if (!dialog) continue
      const r = dialog.getBoundingClientRect()
      out.push({ pin: c, n, left: r.left + c.x, top: r.top + c.y })
    } else if (mainRect) {
      out.push({ pin: c, n, left: mainRect.left + c.x - sx, top: mainRect.top + c.y - sy })
    }
  }
  return out
})

function findDialogByAnchor(selector: string): HTMLElement | null {
  if (!selector.startsWith('dialog:')) return null
  const target = selector.slice(7)
  const all = document.querySelectorAll<HTMLElement>(MODAL_HOSTS)
  for (const d of all) {
    if (dialogIdentifier(d) === target) return d
  }
  return null
}

// Live cursor crosshair — coords are already viewport-relative (the
// mousemove handler captures clientX/Y directly).
const cursorViewport = computed(() => cursor.value)

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (moving.value) { cancelMove(); return }
  if (pinning.value) togglePinning()
}

function togglePinning() {
  pinning.value = !pinning.value
  setPinningCursor(pinning.value)
  if (pinning.value) {
    // Panel stays open: it's docked beside the page (not over it), and while a
    // modal is up the header trigger sits under PrimeVue's mask — closing it
    // here would strand the user with no way to reopen it.
    document.addEventListener('click', onPagePinClick, true)
    document.addEventListener('mousemove', onPagePinMove, true)
  } else {
    cursor.value = null
    clearHover()
    document.removeEventListener('click', onPagePinClick, true)
    document.removeEventListener('mousemove', onPagePinMove, true)
  }
}
function setPinningCursor(on: boolean) {
  if (typeof document === 'undefined') return
  document.body.style.cursor = on ? 'crosshair' : ''
}
// Detect whether the click landed inside a modal/dialog. We treat the
// nearest ancestor with role="dialog" (or the .p-dialog class PrimeVue
// uses) as the anchor. Identifier comes from aria-labelledby's text →
// aria-label → element id. The pin will only render later while a
// dialog with the same identifier is on screen.
// `.app-modal-overlay` is a PAGE rendered as a modal (the event wizards). It
// matters here because that markup is teleported to <body>, i.e. OUTSIDE
// <main> — so main-relative coordinates are meaningless for anything inside it,
// and every pin dropped in a wizard was being drawn against the wrong origin.
// (That is why old wizard pins all pile up down the left edge.)
const MODAL_HOSTS = '[role="dialog"], .p-dialog, .app-modal-overlay'

function dialogAnchorFor(target: HTMLElement): { dialog: HTMLElement; id: string } | null {
  const dialog = target.closest(MODAL_HOSTS) as HTMLElement | null
  if (!dialog) return null
  return { dialog, id: dialogIdentifier(dialog) }
}
function dialogIdentifier(d: HTMLElement): string {
  // A page-as-modal carries its title in the shared brand header bar rather
  // than a PrimeVue dialog title.
  const modalTitle = d.querySelector('.modal-header-title') as HTMLElement | null
  const modalTxt = modalTitle?.textContent?.trim()
  if (modalTxt) return modalTxt.slice(0, 120)
  const labelId = d.getAttribute('aria-labelledby')
  const headerEl = labelId ? document.getElementById(labelId) : null
  const txt = headerEl?.textContent?.trim()
  if (txt) return txt.slice(0, 120)
  const aria = d.getAttribute('aria-label')
  if (aria) return aria.trim().slice(0, 120)
  // Fallback: PrimeVue dialogs typically render a `.p-dialog-title`
  // element inside the header; use that text if available.
  const title = d.querySelector('.p-dialog-title') as HTMLElement | null
  const titleTxt = title?.textContent?.trim()
  if (titleTxt) return titleTxt.slice(0, 120)
  return d.id || 'dialog'
}

interface ClickAnchor {
  x: number
  y: number
  // null → main-relative; "dialog:<id>" → relative to a dialog with that id.
  anchorSelector: string | null
  /**
   * What was CLICKED — field label, section, wizard step, owning component +
   * source file, and a structural path so the pin can be redrawn from the
   * element. Without this a comment is just text at a coordinate, which is
   * unreadable to anyone who wasn't holding the mouse at the time.
   */
  context: ReviewTarget | null
}
function relativeCoords(e: MouseEvent): ClickAnchor | null {
  const context = describeElement(e.target as HTMLElement, { clientX: e.clientX, clientY: e.clientY })
  // 1. Pin landed inside a dialog → anchor to the dialog itself so the
  //    pin lives with the modal (appears whenever the same dialog opens,
  //    disappears when it closes).
  const anchor = dialogAnchorFor(e.target as HTMLElement)
  if (anchor) {
    const r = anchor.dialog.getBoundingClientRect()
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      anchorSelector: `dialog:${anchor.id}`,
      context,
    }
  }
  // 2. Default: anchor to main's scroll content. We don't reject out-of-
  //    bounds coords here — better to drop the pin where the user clicked
  //    than silently fail.
  if (!mainEl.value) return null
  const rect = mainEl.value.getBoundingClientRect()
  return {
    x: e.clientX - rect.left + mainEl.value.scrollLeft,
    y: e.clientY - rect.top  + mainEl.value.scrollTop,
    anchorSelector: null,
    context,
  }
}
// ── Hover highlight while pinning / re-anchoring ─────────────────────
// You are choosing an ELEMENT, so you have to be able to see which one you are
// about to get. Clicking blind is how a pin ends up on a padding wrapper
// instead of the field you meant. This outlines the element under the cursor
// and names what would be captured, so the pin lands on the right thing first
// time — nudge the cursor until the label reads `input "Event Title"`.
const hoverBox = ref<{ left: number; top: number; width: number; height: number } | null>(null)
const hoverLine = ref('')
let lastHoverEl: Element | null = null

function clearHover() {
  hoverBox.value = null
  hoverLine.value = ''
  lastHoverEl = null
}

function updateHoverTarget(e: MouseEvent) {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  // Never highlight our own chrome — the panel is a legitimate place for the
  // cursor to pass over on the way to the page.
  if (!el || el.closest('[data-review-panel]') || el.closest('[data-review-overlay]')) {
    clearHover()
    return
  }
  const r = el.getBoundingClientRect()
  hoverBox.value = { left: r.left, top: r.top, width: r.width, height: r.height }
  // The description walks ancestors and reads framework internals, so only
  // recompute when the element actually changes — not on every mouse move.
  if (el !== lastHoverEl) {
    lastHoverEl = el
    const t = describeElement(el, { clientX: e.clientX, clientY: e.clientY })
    hoverLine.value = describeTargetLine(t) || el.tagName.toLowerCase()
  }
}

function onPagePinMove(e: MouseEvent) {
  // Viewport coords for the crosshair; the anchored coords are stored only
  // when the user actually clicks.
  cursor.value = { x: e.clientX, y: e.clientY }
  updateHoverTarget(e)
}
function onPagePinClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.fixed.bottom-4.right-4')) return
  // The panel stays open during pin mode — clicks on its own controls must
  // not drop a pin onto it.
  if (target.closest('[data-review-panel]')) return
  const coords = relativeCoords(e)
  if (!coords) return
  e.preventDefault()
  e.stopPropagation()
  // Re-anchoring an existing pin rather than composing a new one: no dialog,
  // the comment simply moves to what was just clicked.
  if (movingId.value) { commitMove(coords); return }
  composeCoords.value = coords
  composeBody.value = preservedBody.value
  preservedBody.value = ''
  composeOpen.value = true
  // The composer lives in the panel, so the panel has to be open to see it.
  expanded.value = true
  nextTick(() => (composeInput.value as HTMLTextAreaElement | undefined)?.focus())
  document.removeEventListener('click', onPagePinClick, true)
  document.removeEventListener('mousemove', onPagePinMove, true)
  setPinningCursor(false)
  cursor.value = null
  clearHover()
}

async function commitPin() {
  if (!orgId.value || !composeCoords.value || !composeBody.value.trim()) return
  if (!canPost.value) return
  const data = await reviews.createComment({
    orgId: orgId.value,
    path: pageKey.value,
    body: composeBody.value.trim(),
    authorId: user.value?.id ?? null,
    authorName: authorName.value ?? null,
    reviewerId: activeReviewerId.value,
    x: composeCoords.value.x,
    y: composeCoords.value.y,
    anchorSelector: composeCoords.value.anchorSelector,
    context: composeCoords.value.context as any,
    ready: postsReady.value,
    mentions: composeMentions.value.length ? composeMentions.value : null,
  })
  // Images dropped while writing attach now the row exists.
  let saved = data
  if (saved && composeAttachments.value.length) {
    saved = await reviews.setCommentAttachments(saved.id, [...composeAttachments.value]) ?? saved
  }
  if (saved) comments.value.push(saved)
  if ((review.value?.stage || 'draft') === 'draft') await setStage('in_review')
  composeOpen.value = false
  composeAttachments.value = []
  pinning.value = false
}
function cancelCompose() {
  composeOpen.value = false
  composeBody.value = ''
  composeCoords.value = null
  composeMentions.value = []
  composeAttachments.value = []
  composeDragOver.value = false
  pinning.value = false
}

// ── General (page-level) comments ────────────────────────────────────
const newGeneralBody = ref('')
async function postGeneral() {
  if (!orgId.value || !newGeneralBody.value.trim()) return
  if (!canPost.value) return
  const data = await reviews.createComment({
    orgId: orgId.value,
    path: pageKey.value,
    body: newGeneralBody.value.trim(),
    authorId: user.value?.id ?? null,
    authorName: authorName.value ?? null,
    reviewerId: activeReviewerId.value,
    x: null, y: null,
    ready: postsReady.value,
    mentions: deriveMentions(newGeneralBody.value).length ? deriveMentions(newGeneralBody.value) : null,
  })
  if (data) comments.value.push(data)
  newGeneralBody.value = ''
  if ((review.value?.stage || 'draft') === 'draft') await setStage('in_review')
}

// ── Hand the open comments to Claude ─────────────────────────────────
// Writes docs/review-tasks.md with every open comment plus the context each pin
// captured, then Karl just says "do the review tasks". A FILE rather than a
// clipboard blob so the brief survives the tab closing and can be re-read
// part-way through a long job.
const briefing = ref(false)
const briefResult = ref<{ taskCount: number; pageCount: number; file: string } | null>(null)
/** Scope when nothing is explicitly picked: this page only, or the whole club. */
const briefThisPageOnly = ref(true)

// Explicit task PICKING. Empty = "send the whole scope"; the moment anything is
// ticked, only the ticks go — a deliberate selection outranks the page filter it
// was made under.
const selectedIds = ref<string[]>([])
function toggleSelected(id: string) {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}
const isSelected = (id: string) => selectedIds.value.includes(id)

/**
 * Is this comment a question for a PERSON rather than work for Claude?
 * An @mention on the root comment routes it to whoever's named, so it's kept
 * out of the send flow entirely (the server enforces the same).
 */
const routedToPerson = (c: any) => !c.parent_id && Array.isArray(c.mentions) && c.mentions.length > 0
/** The names behind a comment's @mentions, for the "For Kate" label. */
function mentionNames(c: any): string {
  const ids: string[] = Array.isArray(c.mentions) ? c.mentions : []
  const names = ids.map(id => reviewers.value.find(r => r.id === id)?.name).filter(Boolean)
  return names.length ? names.join(', ') : 'someone'
}

/**
 * Every open comment on this page that is ELIGIBLE to be sent — i.e. approved
 * AND not directed at a person. The server enforces this too; keeping the
 * client in step just means the button's count never promises work that will
 * be filtered out.
 */
const selectableIds = computed(() => [
  ...visibleGeneral.value.filter(c => !c.resolved && c.ready && !routedToPerson(c)).map(c => c.id),
  // openPinned yields { c, n } rows (n = the permanent number), not comments.
  ...openPinned.value.map(row => row.c).filter(c => c.ready && !routedToPerson(c)).map(c => c.id),
])
const allSelected = computed(() =>
  selectableIds.value.length > 0 && selectableIds.value.every(id => isSelected(id)))
function toggleSelectAll() {
  selectedIds.value = allSelected.value ? [] : [...selectableIds.value]
}
// A selection is about the page in front of you; carrying it to the next page
// would silently send comments you can no longer see.
watch(pageKey, () => { selectedIds.value = [] })

/**
 * Hand over the ENTIRE backlog, every page at once.
 *
 * Exists because the brief file is rewritten on each export: sending page by
 * page meant each batch replaced the last, and only the final one survived in
 * the file. Sending everything makes the brief the whole truth.
 */
async function sendAllTasks() {
  if (!orgId.value || briefing.value) return
  const ids = allTasks.value.filter(t => t.ready).map(t => t.id)
  if (!ids.length) return
  briefing.value = true
  briefError.value = null
  try {
    const r = await reviews.buildBrief(orgId.value, null, ids)
    briefResult.value = { taskCount: r.taskCount, pageCount: r.pageCount, file: r.file }
    await loadAllTasks()
    await load()
  } catch (e: any) {
    briefError.value = e?.statusCode === 403
      ? 'Task export runs in local development only.'
      : (e?.statusMessage || 'Could not write the brief.')
  } finally {
    briefing.value = false
  }
}

async function sendToClaude() {
  if (!orgId.value || briefing.value) return
  briefing.value = true
  briefResult.value = null
  briefError.value = null
  try {
    const picked = selectedIds.value.filter(id => selectableIds.value.includes(id))
    const r = await reviews.buildBrief(
      orgId.value,
      picked.length ? null : (briefThisPageOnly.value ? pageKey.value : null),
      picked,
    )
    briefResult.value = { taskCount: r.taskCount, pageCount: r.pageCount, file: r.file }
    // The batch is gone — drop the ticks and re-read, so the sent comments pick
    // up their 'queued' status and move to the In progress tab. Leaving them
    // ticked would invite sending the same work twice.
    selectedIds.value = []
    await load()
  } catch (e: any) {
    // Dev-only endpoint: on a deployed instance this 403s, which is correct and
    // worth saying plainly rather than failing silently.
    briefResult.value = null
    briefError.value = e?.statusCode === 403
      ? 'Task export runs in local development only.'
      : (e?.statusMessage || 'Could not write the brief.')
  } finally {
    briefing.value = false
  }
}
const briefError = ref<string | null>(null)

// ── The ready gate ───────────────────────────────────────────────────
// Anyone on the team can leave a comment; only the builder turns one into work.
// Everything else in the panel treats a not-ready comment normally — it is
// visible, repliable, resolvable — it just cannot be sent to Claude.
async function setReady(c: any, ready: boolean) {
  const data = await reviews.setCommentReady(c.id, ready)
  if (data) {
    const i = comments.value.findIndex(x => x.id === c.id)
    if (i >= 0) comments.value[i] = data
    // Un-approving something that was picked must also un-pick it, or the
    // count on the button would promise work the server will refuse to send.
    if (!ready) selectedIds.value = selectedIds.value.filter(id => id !== c.id)
  }
}
/**
 * Pull a comment back out of Claude's queue.
 *
 * "Queued" means sent but NOT started, so it's the one hand-off you can still
 * take back. Clearing the status returns it to a plain To-do; the brief that
 * already carries it is stale the moment it's regenerated, so there's nothing
 * else to undo. (An item Claude has already started shows 'done' or 'needs_info'
 * instead, and those aren't offered here — you can't un-send finished work.)
 */
async function unqueueComment(c: any) {
  if (c.claude_status !== 'queued') return
  const data = await reviews.setCommentClaudeStatus(c.id, null)
  if (data) {
    const i = comments.value.findIndex(x => x.id === c.id)
    if (i >= 0) comments.value[i] = data
    if (focusedId.value === c.id) { /* card re-renders from comments */ }
  }
}

// ── Mentions addressed to me, from anywhere ──────────────────────────
// The panel is page-scoped, so a mention left on another screen would never be
// seen by the person it names. This is the one cross-page read in the widget.
const myMentions = ref<any[]>([])
const showMentions = ref(false)
async function loadMentions() {
  if (!orgId.value || !meReviewer.value) { myMentions.value = []; return }
  try {
    myMentions.value = await reviews.mentionsFor(orgId.value, meReviewer.value.id)
  } catch {
    // A missing route (dev server not restarted) must not break the panel.
    myMentions.value = []
  }
}
// Loaded whether or not the panel is open: the whole point of the header badge
// is to tell you that you've been asked something BEFORE you think to look.
// Also refreshed on page change, since it's the natural moment to re-check.
watch([orgId, meReviewer, pageKey], loadMentions, { immediate: true })
// Opening the panel re-reads, so acting on one mention updates the count.
watch(expanded, (open) => { if (open) loadMentions() })

/** Published for the header comment icon (see useReviewMentionCount). */
const sharedMentionCount = useReviewMentionCount()
watch(myMentions, v => { sharedMentionCount.value = v.length }, { immediate: true })

/**
 * Can we actually navigate to the page a mention is on?
 *
 * pageKey is a route PATTERN, so `/events/:id` names a screen but not a URL —
 * the id is exactly what it threw away. Those rows show where the comment lives
 * without pretending to be a link, the same compromise the Report tab makes.
 */
function mentionPathNavigable(path: string) { return !path.includes(':') }
function goToMention(c: any) {
  if (!mentionPathNavigable(c.path)) return
  showMentions.value = false
  navigateTo(c.path.split('?')[0])
}

// ── Push modals aside when the panel is docked ───────────────────────
// The panel shifts the PAGE left, but every modal is teleported to <body> and so
// sits outside what gets shifted — it stayed centred, under the panel. This
// class lets one CSS rule (main.css) move the modal layers by the same amount,
// rather than every modal needing to know the panel exists.
watch(expanded, (open) => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('review-panel-open', open)
}, { immediate: true })
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.body.classList.remove('review-panel-open')
})

// ── Don't let a missed image-drop navigate the page away ─────────────
// Dropping a file on a browser's default handler NAVIGATES to that file. While
// the review panel is open you're being invited to drag images around, and a
// near-miss would blow away whatever is on screen — an unsaved wizard draft
// included. These run at document level in the bubble phase, so a real drop
// target (a comment card) still handles its own drop first; this only catches
// the ones nothing claimed.
function swallowStrayDrag(e: DragEvent) {
  if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return
  e.preventDefault()
}
watch(expanded, (open) => {
  if (typeof document === 'undefined') return
  if (open) {
    document.addEventListener('dragover', swallowStrayDrag)
    document.addEventListener('drop', swallowStrayDrag)
  } else {
    document.removeEventListener('dragover', swallowStrayDrag)
    document.removeEventListener('drop', swallowStrayDrag)
  }
}, { immediate: true })
onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  document.removeEventListener('dragover', swallowStrayDrag)
  document.removeEventListener('drop', swallowStrayDrag)
})

// ── Image attachments ────────────────────────────────────────────────
// The upload itself happens in the card (it owns the drop target); the widget
// owns the write, so there is still one place that talks to the seam.
async function addAttachments(c: any, files: { url: string; name: string }[]) {
  const next = [...(Array.isArray(c.attachments) ? c.attachments : []), ...files]
  await saveAttachments(c, next)
}
async function removeAttachment(c: any, index: number) {
  const next = (Array.isArray(c.attachments) ? [...c.attachments] : [])
  next.splice(index, 1)
  await saveAttachments(c, next)
}
async function saveAttachments(c: any, next: { url: string; name?: string | null }[]) {
  const data = await reviews.setCommentAttachments(c.id, next)
  if (data) {
    const i = comments.value.findIndex(x => x.id === c.id)
    if (i >= 0) comments.value[i] = data
  }
}

/** Open comments waiting on the builder's approval — the triage queue. */
const pendingCount = computed(() =>
  comments.value.filter(c => !c.resolved && !c.ready && !c.parent_id).length)

// ── Editing a comment ────────────────────────────────────────────────
// Reviewers type these fast, mid-flow — typos and half-thoughts are normal, and
// before this the only fix was delete-and-repin (which loses the pin's captured
// context along with the comment).
const editOpenFor = ref<string | null>(null)
const editBody = ref('')
function startEdit(c: any) {
  editOpenFor.value = c.id
  editBody.value = c.body
}
function cancelEdit() {
  editOpenFor.value = null
  editBody.value = ''
}
/**
 * Save the edit and hand this ONE comment straight to Claude. Marks it ready
 * first — sending is an unambiguous statement that it's work, so making the
 * builder tick a second box to say so would just be ceremony.
 */
async function saveEditAndSend(c: any) {
  await saveEdit(c)
  const fresh = comments.value.find(x => x.id === c.id)
  if (fresh && !fresh.ready) await setReady(fresh, true)
  if (!orgId.value) return
  briefing.value = true
  briefError.value = null
  try {
    const r = await reviews.buildBrief(orgId.value, null, [c.id])
    briefResult.value = { taskCount: r.taskCount, pageCount: r.pageCount, file: r.file }
    selectedIds.value = selectedIds.value.filter(id => id !== c.id)
    await load()
  } catch (e: any) {
    briefError.value = e?.statusCode === 403
      ? 'Task export runs in local development only.'
      : (e?.statusMessage || 'Could not write the brief.')
  } finally {
    briefing.value = false
  }
}

async function saveEdit(c: any) {
  const body = editBody.value.trim()
  if (body && body !== c.body) {
    const data = await reviews.updateCommentBody(c.id, body, deriveMentions(body))
    if (data) {
      const i = comments.value.findIndex(x => x.id === c.id)
      if (i >= 0) comments.value[i] = data
    }
  }
  cancelEdit()
  // Save means "I'm done with this comment", so it also closes the focused
  // card. Leaving it open afterwards read as though nothing had happened —
  // the same panel, still showing Move pin / Edit text / a drop zone.
  if (focusedId.value === c.id) focusedId.value = null
}

// ── Replies ──────────────────────────────────────────────────────────
const replyOpenFor = ref<string | null>(null)
const replyBody = ref('')

// Images on a reply, dropped while writing it. A reply is often where the
// screenshot belongs ("here's what I mean"), so it needs the same affordance as
// the comment itself. Uploaded immediately, attached once the reply exists.
const replyAttachments = ref<{ url: string; name: string }[]>([])
const replyMentions = ref<string[]>([])
const replyDragOver = ref(false)
const replyUploading = ref(false)
const { uploadFile: uploadReplyFile } = useUpload()
function onReplyDragEnter(e: DragEvent) {
  if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) replyDragOver.value = true
}
async function onReplyDrop(e: DragEvent) {
  replyDragOver.value = false
  const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
  if (!files.length) return
  replyUploading.value = true
  try {
    for (const f of files) {
      try {
        const { url } = await uploadReplyFile(f)
        if (url) replyAttachments.value.push({ url, name: f.name })
      } catch { /* one bad file shouldn't lose the rest */ }
    }
  } finally {
    replyUploading.value = false
  }
}
function openReply(parent: any) {
  replyOpenFor.value = parent.id
  replyBody.value = ''
  // Images belong to the reply being written, so a fresh reply starts empty —
  // otherwise a picture dropped and abandoned would follow you to the next one.
  replyAttachments.value = []
}
function cancelReply() {
  replyOpenFor.value = null
  replyBody.value = ''
  replyAttachments.value = []
  replyMentions.value = []
  replyDragOver.value = false
}
async function commitReply(parent: any): Promise<boolean> {
  if (!orgId.value || (!replyBody.value.trim() && !replyAttachments.value.length)) return false
  if (!canPost.value) return false
  const data = await reviews.createComment({
    orgId: orgId.value,
    path: pageKey.value,
    parentId: parent.id,
    body: replyBody.value.trim(),
    authorId: user.value?.id ?? null,
    authorName: authorName.value ?? null,
    reviewerId: activeReviewerId.value,
    x: null, y: null,
    // A reply rides on its parent's standing — it clarifies approved work
    // rather than proposing something new.
    ready: Boolean(parent.ready) || postsReady.value,
    mentions: replyMentions.value.length ? replyMentions.value : null,
  })
  // Images dropped while writing are attached once the reply row exists — a
  // comment has to have an id before anything can hang off it.
  let saved = data
  if (saved && replyAttachments.value.length) {
    saved = await reviews.setCommentAttachments(saved.id, [...replyAttachments.value]) ?? saved
  }
  if (saved) comments.value.push(saved)
  replyOpenFor.value = null
  replyBody.value = ''
  replyAttachments.value = []
  replyMentions.value = []
  replyDragOver.value = false
  return !!saved
}

/**
 * Reply AND send the task back to Claude.
 *
 * The point of replying to a BLOCKED task is to unblock it — but a reply on its
 * own just lands in the thread and nothing tells Claude to look again. This
 * posts the reply, clears any "needs more info" flag on the parent (the question
 * has been answered), and re-sends just that task, so the answer actually
 * reaches Claude and the work resumes.
 */
async function commitReplyAndSend(parent: any) {
  if (!(await commitReply(parent))) return
  // Answered → drop the "needs more info" state so it reads as back-in-progress,
  // not still-waiting-on-you. A task Claude hasn't touched has no status to clear.
  if (parent.claude_status === 'needs_info') {
    const cleared = await reviews.setCommentClaudeStatus(parent.id, null)
    if (cleared) {
      const i = comments.value.findIndex(x => x.id === parent.id)
      if (i >= 0) comments.value[i] = cleared
    }
  }
  if (!orgId.value) return
  briefing.value = true
  briefError.value = null
  try {
    const r = await reviews.buildBrief(orgId.value, null, [parent.id])
    briefResult.value = { taskCount: r.taskCount, pageCount: r.pageCount, file: r.file }
    await load()
  } catch (e: any) {
    briefError.value = e?.statusCode === 403
      ? 'Sending tasks to Claude runs in local development only.'
      : (e?.statusMessage || 'Could not send the task.')
  } finally {
    briefing.value = false
  }
}

// ── Opening a pin ────────────────────────────────────────────────────
// Clicking a pin used to open a MODAL, which covered the very thing the pin was
// pointing at — you could read the note or look at the screen, never both. Now
// it focuses the comment at the top of the (side-docked) panel in edit mode,
// leaving the page fully visible beside it.
const focusedId = ref<string | null>(null)
/**
 * Hovering a comment's number in the panel pulses its pin on the page. With the
 * panel docked beside the page rather than over it, both are visible at once —
 * so "which control is this note about?" is answerable without clicking, and
 * without losing your place in the list.
 */
const hoverPinId = ref<string | null>(null)
const focused = computed(() => comments.value.find(c => c.id === focusedId.value) ?? null)
/** Its permanent number, so the focused card and the page pin agree. */
const focusedPinNumber = computed(() => {
  const c = focused.value
  if (!c || c.x == null) return null
  if (c.seq != null) return c.seq
  const i = screenPins.value.findIndex(x => x.id === c.id)
  return i >= 0 ? i + 1 : null
})
function openComment(c: any) {
  // Idempotent: clicking the same pin again must not re-seed the editor, which
  // would silently discard whatever has been typed into it.
  if (focusedId.value === c.id) { expanded.value = true; revealTarget(c); return }
  focusedId.value = c.id
  expanded.value = true
  startEdit(c)
  revealTarget(c)
}

/**
 * Take me to the thing this comment is about.
 *
 * Scrolling to it only works if it's on screen at all — and on a wizard, most
 * comments are about a step you aren't standing on, so the element isn't in the
 * DOM to scroll to. When that happens we ASK THE PAGE to change view, using the
 * scope the pin captured ("Step 3 of 6 · Fees"), then try again once it has.
 *
 * A CustomEvent rather than a prop or a store: the widget is mounted once in the
 * layout and knows nothing about any page's internal state, and no page should
 * have to know the review tool exists. A page that wants this listens; one that
 * doesn't simply never responds, and we fall back to highlighting the pin.
 */
function revealTarget(c: any, allowStepChange = true) {
  if (typeof window === 'undefined') return
  const el = c?.context ? resolveTargetElement(c.context) : null
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    flashElement(el)
    return
  }
  const scope = c?.context?.scope ?? null
  // The DIALOG the pin was inside, when it was inside one. Half these comments
  // were made in a modal ("New Discount Rule", "Add Discount"), and a modal
  // that isn't open has no element to scroll to — so the page needs to be told
  // to open it, not just to change step.
  const dialog = c?.context?.dialog ?? null
  if (!allowStepChange || (!scope && !dialog)) return
  window.dispatchEvent(new CustomEvent('review:goto', { detail: { scope, dialog, commentId: c.id } }))
  // Give the page a moment to switch step and/or open the dialog, then take the
  // scroll — but don't ask it again, or a page that can't honour the request
  // would bounce forever. A dialog has an entry animation, hence the longer wait.
  setTimeout(() => revealTarget(c, false), dialog ? 450 : 250)
}

/** Briefly ring the element so it's obvious which one the comment meant. */
function flashElement(el: Element) {
  el.classList.add('review-flash')
  setTimeout(() => el.classList.remove('review-flash'), 1600)
}
function closeFocused() {
  cancelEdit()
  cancelMove()
  focusedId.value = null
}
// A focus belongs to the page it was made on.
watch(pageKey, () => { focusedId.value = null })

async function resolveComment(c: any) {
  const data = await reviews.setCommentResolved(c.id, true, user.value?.id ?? null)
  if (data) {
    const i = comments.value.findIndex(x => x.id === c.id)
    if (i >= 0) comments.value[i] = data
    if (focusedId.value === c.id) closeFocused()
  }
}
async function reopenComment(c: any) {
  const data = await reviews.setCommentResolved(c.id, false, null)
  if (data) {
    const i = comments.value.findIndex(x => x.id === c.id)
    if (i >= 0) comments.value[i] = data
  }
}

// ── Re-anchoring a pin ───────────────────────────────────────────────
// The capture picks the element under the cursor, which is sometimes a wrapper
// rather than the control you meant — and every comment made before capture
// existed has no element at all. "Move pin" re-runs the capture against a fresh
// click, so an old note can be attached to its element retrospectively.
const movingId = ref<string | null>(null)
const moving = computed(() => movingId.value !== null)
function startMove(c: any) {
  if (pinning.value) togglePinning()
  movingId.value = c.id
  setPinningCursor(true)
  document.addEventListener('click', onPagePinClick, true)
  document.addEventListener('mousemove', onPagePinMove, true)
}
function cancelMove() {
  if (!movingId.value) return
  movingId.value = null
  cursor.value = null
  clearHover()
  setPinningCursor(false)
  document.removeEventListener('click', onPagePinClick, true)
  document.removeEventListener('mousemove', onPagePinMove, true)
}
async function commitMove(anchor: ClickAnchor) {
  const id = movingId.value
  cancelMove()
  if (!id) return
  const data = await reviews.moveComment(id, {
    x: anchor.x, y: anchor.y,
    anchorSelector: anchor.anchorSelector,
    context: anchor.context as any,
  })
  if (data) {
    const i = comments.value.findIndex(x => x.id === id)
    if (i >= 0) comments.value[i] = data
  }
}
// Hard delete — gated to the builder (developer role) only. Wipes the
// comment plus any replies pinned underneath it, with no soft-delete
// trail since prototype review noise shouldn't accumulate.
async function deleteComment(c: any) {
  // Was developer-only. Widened to the builder and the comment's own author:
  // deleting a note you left by mistake shouldn't require resolving it, which
  // would file it as reviewed work that was never work in the first place.
  const mine = !!c.author_name && c.author_name === authorName.value
  if (!isDeveloper.value && !isBuilder.value && !mine) return
  const replies = repliesByParent.value[c.id]?.length ?? 0
  const warning = replies
    ? `Delete this comment and its ${replies} repl${replies === 1 ? 'y' : 'ies'}? This cannot be undone.`
    : 'Delete this comment? This cannot be undone.'
  if (!confirm(warning)) return
  await reviews.deleteComment(c.id)
  comments.value = comments.value.filter(x => x.id !== c.id && x.parent_id !== c.id)
  if (focusedId.value === c.id) closeFocused()
}

// ── Helpers ──────────────────────────────────────────────────────────
function initialsOf(name: string): string {
  const parts = (name || '').split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function formatRelative(iso: string): string {
  const d = new Date(iso)
  const ms = Date.now() - d.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
/* Right-docked review drawer slide in/out */
.rw-drawer-enter-active,
.rw-drawer-leave-active { transition: transform 0.3s ease; }
.rw-drawer-enter-from,
.rw-drawer-leave-to { transform: translateX(100%); }
</style>
