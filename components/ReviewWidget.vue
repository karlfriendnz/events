<template>
  <!-- Pin overlays — Teleported to <body> with fixed positioning so they
       sit above modals (PrimeVue masks land at z-1100; we go far above).
       Coords are stored as <main>-relative so pins scroll with content;
       we just project into viewport space at render time. Inline style
       used for z-index so Tailwind's JIT can't accidentally drop it. -->
  <Teleport to="body">
    <div v-if="pinsVisible && screenPinPositions.length"
      class="fixed inset-0 pointer-events-none"
      style="z-index: 2147483000">
      <div
        v-for="(p, i) in screenPinPositions" :key="p.pin.id"
        class="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none"
        :style="{ left: `${p.left}px`, top: `${p.top}px` }"
        @click.stop="openComment(p.pin)">
        <div class="w-7 h-7 rounded-full ring-2 ring-white shadow-md flex items-center justify-center text-[11px] font-bold hover:scale-110 transition-transform"
          :style="{ background: pinColorFor(p.pin), color: pinTextColorFor(p.pin) }">
          {{ i + 1 }}
        </div>
      </div>
    </div>
    <div v-if="pinning && cursorViewport"
      class="fixed pointer-events-none -translate-x-1/2 -translate-y-1/2"
      :style="{ left: `${cursorViewport.x}px`, top: `${cursorViewport.y}px`, zIndex: 2147483000 }">
      <div class="w-7 h-7 rounded-full bg-amber-400/60 ring-2 ring-white shadow-md" />
    </div>
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

    <Transition name="rw-drawer">
    <div v-if="expanded"
      class="fixed top-0 right-0 bottom-0 w-full md:w-[440px] bg-white border-l border-gray-200 shadow-2xl overflow-hidden flex flex-col z-[80]">
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
          <label class="flex items-center gap-1.5 text-[11px] text-gray-500 select-none cursor-pointer">
            <input type="checkbox" v-model="hideResolved" class="accent-primary w-3 h-3" />
            Hide resolved
          </label>
        </div>

        <!-- Hint while pinning -->
        <div v-if="pinning" class="px-4 py-2 bg-amber-50 text-amber-800 text-[11px] border-b border-amber-100">
          <i class="pi pi-info-circle mr-1" /> Click anywhere on the page to drop a pin.
        </div>

        <!-- Comments list -->
        <div class="px-4 py-3 space-y-2">
          <p v-if="!openPinned.length && !resolvedPinned.length && !visibleGeneral.length"
            class="text-xs text-gray-400 text-center py-4">
            {{ hideResolved ? 'No open comments on this page.' : 'No comments on this page yet.' }}
          </p>

          <!-- Open pinned (numbered to match on-screen pins) -->
          <div v-for="(c, i) in openPinned" :key="c.id"
            class="rounded-lg border border-gray-100 hover:bg-gray-50">
            <div class="flex items-start gap-2 p-2">
              <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                :style="{ background: pinColorFor(c), color: pinTextColorFor(c) }">
                {{ i + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] text-gray-400 mb-0.5">
                  {{ authorLabelFor(c) }} · {{ formatRelative(c.created_at) }}
                </p>
                <p class="text-xs text-gray-700 whitespace-pre-wrap break-words">{{ c.body }}</p>
              </div>
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
                  {{ initialsOf(authorLabelFor(reply)) }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] text-gray-400 mb-0.5">
                    {{ authorLabelFor(reply) }} · {{ formatRelative(reply.created_at) }}
                  </p>
                  <p class="text-xs text-gray-700 whitespace-pre-wrap break-words">{{ reply.body }}</p>
                </div>
                <button v-if="isDeveloper" type="button" class="text-gray-300 hover:text-red-500 self-start mt-0.5"
                  v-tooltip.left="'Delete'"
                  @click="deleteComment(reply)">
                  <i class="pi pi-trash text-[10px]" />
                </button>
              </div>
              <div v-if="replyOpenFor === c.id" class="flex flex-col gap-1">
                <textarea v-model="replyBody" rows="2" autofocus
                  class="w-full text-xs border border-gray-200 rounded-md p-2 focus:outline-none focus:border-primary"
                  placeholder="Reply…" />
                <div class="flex items-center gap-2 justify-end">
                  <button type="button" class="text-[10px] text-gray-500 hover:text-gray-700"
                    @click="cancelReply">Cancel</button>
                  <Button label="Reply" size="small" :disabled="!replyBody.trim()"
                    @click="commitReply(c)"
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
                    {{ initialsOf(authorLabelFor(reply)) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] text-gray-400 mb-0.5">
                      {{ authorLabelFor(reply) }} · {{ formatRelative(reply.created_at) }}
                    </p>
                    <p class="text-xs text-gray-700 whitespace-pre-wrap break-words">{{ reply.body }}</p>
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

          <div v-if="visibleGeneral.length" class="pt-2 border-t border-gray-100 space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Page-level</p>
            <div v-for="c in visibleGeneral" :key="c.id"
              class="rounded-lg border border-gray-100 hover:bg-gray-50"
              :class="c.resolved ? 'opacity-60' : ''">
              <div class="flex items-start gap-2 p-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                  :style="{ background: pinColorFor(c), color: pinTextColorFor(c) }">
                  {{ initialsOf(authorLabelFor(c)) }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] text-gray-400 mb-0.5">
                    {{ authorLabelFor(c) }} · {{ formatRelative(c.created_at) }}
                    <span v-if="c.resolved" class="ml-1 text-emerald-600 font-semibold">· Resolved</span>
                  </p>
                  <p class="text-xs text-gray-700 whitespace-pre-wrap break-words"
                    :class="c.resolved ? 'line-through' : ''">{{ c.body }}</p>
                </div>
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
                    {{ initialsOf(authorLabelFor(reply)) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] text-gray-400 mb-0.5">
                      {{ authorLabelFor(reply) }} · {{ formatRelative(reply.created_at) }}
                    </p>
                    <p class="text-xs text-gray-700 whitespace-pre-wrap break-words">{{ reply.body }}</p>
                  </div>
                  <button v-if="isDeveloper" type="button" class="text-gray-300 hover:text-red-500 self-start mt-0.5"
                    v-tooltip.left="'Delete'"
                    @click="deleteComment(reply)">
                    <i class="pi pi-trash text-[10px]" />
                  </button>
                </div>
                <div v-if="replyOpenFor === c.id" class="flex flex-col gap-1">
                  <textarea v-model="replyBody" rows="2" autofocus
                    class="w-full text-xs border border-gray-200 rounded-md p-2 focus:outline-none focus:border-primary"
                    placeholder="Reply…" />
                  <div class="flex items-center gap-2 justify-end">
                    <button type="button" class="text-[10px] text-gray-500 hover:text-gray-700"
                      @click="cancelReply">Cancel</button>
                    <Button label="Reply" size="small" :disabled="!replyBody.trim()"
                      @click="commitReply(c)"
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

          <!-- New page-level comment -->
          <div class="pt-2 border-t border-gray-100">
            <textarea v-model="newGeneralBody" rows="2"
              class="w-full text-xs border border-gray-200 rounded-md p-2 focus:outline-none focus:border-primary"
              placeholder="Page-level comment…" />
            <div class="flex justify-end mt-1">
              <Button label="Post" size="small" :disabled="!newGeneralBody.trim()"
                @click="postGeneral"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </div>
        </div>
      </div>

      <!-- SIGN-OFFS panel — per-reviewer approval list for the current page -->
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
    </Transition>
  </div>

  <!-- Comment compose dialog -->
  <Dialog v-model:visible="composeOpen" modal :draggable="false" :closable="true"
    header="Add comment" :style="{ width: '95vw', maxWidth: '420px' }">
    <p v-if="activeReviewer" class="text-[11px] text-gray-500 mb-2 flex items-center gap-1.5">
      Posting as
      <span class="inline-flex items-center gap-1 font-semibold"
        :style="{ color: activeReviewer.color || '#1E2157' }">
        <span class="w-2 h-2 rounded-full"
          :style="{ background: activeReviewer.color || '#1E2157' }" />
        {{ activeReviewer.name }}
      </span>
    </p>
    <textarea v-model="composeBody" rows="4" autofocus
      class="w-full text-sm border border-gray-200 rounded-md p-2 focus:outline-none focus:border-primary"
      placeholder="Describe what needs attention…" />
    <template #footer>
      <Button label="Cancel" outlined size="small" @click="cancelCompose" />
      <Button label="Post pin" icon="pi pi-check" size="small"
        :disabled="!composeBody.trim()"
        @click="commitPin"
        style="background:var(--brand-primary);border-color:var(--brand-primary)" />
    </template>
  </Dialog>

  <!-- Comment view dialog -->
  <Dialog v-model:visible="viewOpen" modal :draggable="false" :closable="true"
    :header="`Pin #${viewIndex != null ? viewIndex + 1 : ''}`" :style="{ width: '95vw', maxWidth: '420px' }">
    <div v-if="viewing" class="space-y-2">
      <p class="text-[11px] text-gray-400">
        {{ viewing.author_name || 'Unknown' }} · {{ formatRelative(viewing.created_at) }}
      </p>
      <p class="text-sm text-gray-700 whitespace-pre-wrap"
        :class="viewing.resolved ? 'line-through opacity-70' : ''">{{ viewing.body }}</p>
      <p v-if="viewing.resolved" class="text-[11px] text-emerald-600 font-semibold">
        <i class="pi pi-check-circle text-[10px]" /> Resolved {{ viewing.resolved_at ? formatRelative(viewing.resolved_at) : '' }}
      </p>
    </div>
    <template #footer>
      <Button label="Close" outlined size="small" @click="viewOpen = false" />
      <Button v-if="isDeveloper && viewing" label="Delete" icon="pi pi-trash" size="small" severity="danger"
        @click="deleteComment(viewing)" />
      <Button v-if="viewing && viewing.resolved" label="Reopen" icon="pi pi-undo" size="small"
        @click="reopenAndClose"
        style="background:#f59e0b;border-color:#f59e0b" />
      <Button v-else-if="viewing" label="Resolve" icon="pi pi-check" size="small"
        @click="resolveAndClose"
        style="background:#10b981;border-color:#10b981" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
const route = useRoute()
const db = useDb()
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

const panel = ref<'page' | 'signoffs'>('page')
const panelTabs: { value: 'page' | 'signoffs'; label: string }[] = [
  { value: 'page',     label: 'This page' },
  { value: 'signoffs', label: 'Sign-offs' },
]

const review = ref<any | null>(null)
const comments = ref<any[]>([])
const reviewers = ref<any[]>([])
const signoffsForPage = ref<any[]>([])

const hideResolved = ref(false)

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
  return topLevel.value.filter(c => c.x != null && c.y != null && !c.resolved)
})
// Pinned comments still shown in the list. Split into open (numbered to
// match on-screen pins) and resolved (no number, may be hidden via the
// toggle) so list ordering matches what the user sees on the page.
const openPinned = computed(() => screenPins.value)
const resolvedPinned = computed(() => {
  if (hideResolved.value) return []
  return topLevel.value.filter(c => c.x != null && c.y != null && c.resolved)
})
const visibleGeneral = computed(() => {
  return topLevel.value
    .filter(c => c.x == null || c.y == null)
    .filter(c => !hideResolved.value || !c.resolved)
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
const canEditStage = computed(() => meReviewer.value?.name === 'Karl')

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
function pinColorFor(c: any): string {
  return reviewerForComment(c)?.color || '#fbbf24'
}
function pinTextColorFor(c: any): string {
  // White text on most palette colours, dark text on the amber default.
  return reviewerForComment(c) ? '#ffffff' : '#111827'
}
function authorLabelFor(c: any): string {
  return reviewerForComment(c)?.name || c.author_name || 'Unknown'
}

// ── Reviewers — load + auto-seed on first use ────────────────────────
async function loadReviewers() {
  if (!orgId.value) return
  const { data } = await (db.from as any)('page_reviewers')
    .select('*')
    .eq('org_id', orgId.value)
    .order('sort_order').order('name')
  if (!data || data.length === 0) {
    const rows = DEFAULT_REVIEWERS.map(r => ({ ...r, org_id: orgId.value }))
    const { data: inserted } = await (db.from as any)('page_reviewers')
      .insert(rows).select()
    reviewers.value = inserted ?? []
  } else {
    reviewers.value = data
  }
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
  await (db.from as any)('page_reviewers').insert({
    org_id: orgId.value, name, role: 'Admin',
    color: colors[reviewers.value.length % colors.length],
    sort_order: reviewers.value.length,
  })
  await loadReviewers()
  creatingReviewer.value = false
}

// ── Per-page load: review row + comments + sign-offs for current pageKey ─
async function load() {
  if (!orgId.value) return
  const key = pageKey.value
  const [{ data: r }, { data: cs }, { data: ss }] = await Promise.all([
    (db.from as any)('page_reviews')
      .select('*')
      .eq('org_id', orgId.value).eq('path', key)
      .maybeSingle(),
    (db.from as any)('page_comments')
      .select('*')
      .eq('org_id', orgId.value).eq('path', key)
      .order('created_at', { ascending: true }),
    (db.from as any)('page_signoffs')
      .select('*')
      .eq('org_id', orgId.value).eq('path', key),
  ])
  review.value = r
  comments.value = cs ?? []
  signoffsForPage.value = ss ?? []
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
  const key = pageKey.value
  const patch: any = { stage, updated_at: new Date().toISOString() }
  if (stage === 'approved') {
    patch.approved_by = user.value?.id ?? null
    patch.approved_at = new Date().toISOString()
  } else {
    patch.approved_by = null
    patch.approved_at = null
  }
  if (review.value) {
    const { data } = await (db.from as any)('page_reviews')
      .update(patch).eq('id', review.value.id).select().single()
    review.value = data
  } else {
    const { data } = await (db.from as any)('page_reviews')
      .insert({ org_id: orgId.value, path: key, ...patch })
      .select().single()
    review.value = data
  }
}

// ── Sign-offs (per reviewer) ─────────────────────────────────────────
async function signOff(r: any) {
  if (!orgId.value) return
  // Defence-in-depth: the only sign-off button rendered is the one for
  // the logged-in user. Reject any other case anyway.
  if (!meReviewer.value || r.id !== meReviewer.value.id) return
  const payload = {
    org_id: orgId.value,
    path: pageKey.value,
    reviewer_id: r.id,
    signed_by_user_id: user.value?.id ?? null,
  }
  const { data } = await (db.from as any)('page_signoffs').insert(payload).select().single()
  if (data) signoffsForPage.value.push(data)
  // Auto-promote stage when all reviewers have signed.
  if (signoffsForPage.value.length === reviewers.value.length && reviewers.value.length > 0) {
    if ((review.value?.stage || 'draft') !== 'approved') await setStage('approved')
  }
}
async function revokeSignoff(r: any) {
  const existing = signoffsByReviewer.value[r.id]
  if (!existing) return
  await (db.from as any)('page_signoffs').delete().eq('id', existing.id)
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
const screenPinPositions = computed(() => {
  void viewportTick.value
  const out: { pin: any; left: number; top: number }[] = []
  const mainRect = mainEl.value?.getBoundingClientRect()
  const sx = mainEl.value?.scrollLeft ?? 0
  const sy = mainEl.value?.scrollTop ?? 0
  for (const c of screenPins.value) {
    if (c.anchor_selector) {
      const dialog = findDialogByAnchor(c.anchor_selector)
      if (!dialog) continue
      const r = dialog.getBoundingClientRect()
      out.push({ pin: c, left: r.left + c.x, top: r.top + c.y })
    } else if (mainRect) {
      out.push({ pin: c, left: mainRect.left + c.x - sx, top: mainRect.top + c.y - sy })
    }
  }
  return out
})

function findDialogByAnchor(selector: string): HTMLElement | null {
  if (!selector.startsWith('dialog:')) return null
  const target = selector.slice(7)
  const all = document.querySelectorAll<HTMLElement>('[role="dialog"], .p-dialog')
  for (const d of all) {
    if (dialogIdentifier(d) === target) return d
  }
  return null
}

// Live cursor crosshair — coords are already viewport-relative (the
// mousemove handler captures clientX/Y directly).
const cursorViewport = computed(() => cursor.value)

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && pinning.value) togglePinning()
}

function togglePinning() {
  pinning.value = !pinning.value
  setPinningCursor(pinning.value)
  if (pinning.value) {
    expanded.value = false
    document.addEventListener('click', onPagePinClick, true)
    document.addEventListener('mousemove', onPagePinMove, true)
  } else {
    cursor.value = null
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
function dialogAnchorFor(target: HTMLElement): { dialog: HTMLElement; id: string } | null {
  const dialog = (target.closest('[role="dialog"]') || target.closest('.p-dialog')) as HTMLElement | null
  if (!dialog) return null
  return { dialog, id: dialogIdentifier(dialog) }
}
function dialogIdentifier(d: HTMLElement): string {
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
}
function relativeCoords(e: MouseEvent): ClickAnchor | null {
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
  }
}
function onPagePinMove(e: MouseEvent) {
  // Just need viewport coords for the crosshair indicator — the
  // anchored coords are stored only when the user actually clicks.
  cursor.value = { x: e.clientX, y: e.clientY }
}
function onPagePinClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.fixed.bottom-4.right-4')) return
  const coords = relativeCoords(e)
  if (!coords) return
  e.preventDefault()
  e.stopPropagation()
  composeCoords.value = coords
  composeBody.value = ''
  composeOpen.value = true
  document.removeEventListener('click', onPagePinClick, true)
  document.removeEventListener('mousemove', onPagePinMove, true)
  setPinningCursor(false)
  cursor.value = null
}

async function commitPin() {
  if (!orgId.value || !composeCoords.value || !composeBody.value.trim()) return
  if (!canPost.value) return
  const payload = {
    org_id: orgId.value,
    path: pageKey.value,
    body: composeBody.value.trim(),
    author_id: user.value?.id ?? null,
    author_name: authorName.value ?? null,
    reviewer_id: activeReviewerId.value,
    x: composeCoords.value.x,
    y: composeCoords.value.y,
    anchor_selector: composeCoords.value.anchorSelector,
  }
  const { data } = await (db.from as any)('page_comments').insert(payload).select().single()
  if (data) comments.value.push(data)
  if ((review.value?.stage || 'draft') === 'draft') await setStage('in_review')
  composeOpen.value = false
  pinning.value = false
}
function cancelCompose() {
  composeOpen.value = false
  composeBody.value = ''
  composeCoords.value = null
  pinning.value = false
}

// ── General (page-level) comments ────────────────────────────────────
const newGeneralBody = ref('')
async function postGeneral() {
  if (!orgId.value || !newGeneralBody.value.trim()) return
  if (!canPost.value) return
  const payload = {
    org_id: orgId.value,
    path: pageKey.value,
    body: newGeneralBody.value.trim(),
    author_id: user.value?.id ?? null,
    author_name: authorName.value ?? null,
    reviewer_id: activeReviewerId.value,
    x: null, y: null,
  }
  const { data } = await (db.from as any)('page_comments').insert(payload).select().single()
  if (data) comments.value.push(data)
  newGeneralBody.value = ''
  if ((review.value?.stage || 'draft') === 'draft') await setStage('in_review')
}

// ── Replies ──────────────────────────────────────────────────────────
const replyOpenFor = ref<string | null>(null)
const replyBody = ref('')
function openReply(parent: any) {
  replyOpenFor.value = parent.id
  replyBody.value = ''
}
function cancelReply() {
  replyOpenFor.value = null
  replyBody.value = ''
}
async function commitReply(parent: any) {
  if (!orgId.value || !replyBody.value.trim()) return
  if (!canPost.value) return
  const payload = {
    org_id: orgId.value,
    path: pageKey.value,
    parent_id: parent.id,
    body: replyBody.value.trim(),
    author_id: user.value?.id ?? null,
    author_name: authorName.value ?? null,
    reviewer_id: activeReviewerId.value,
    x: null, y: null,
  }
  const { data } = await (db.from as any)('page_comments').insert(payload).select().single()
  if (data) comments.value.push(data)
  replyOpenFor.value = null
  replyBody.value = ''
}

// ── View / resolve / reopen comments ─────────────────────────────────
const viewOpen = ref(false)
const viewing = ref<any | null>(null)
const viewIndex = ref<number | null>(null)
function openComment(c: any) {
  viewing.value = c
  viewIndex.value = screenPins.value.findIndex(x => x.id === c.id)
  viewOpen.value = true
}
async function resolveComment(c: any) {
  const stamp = new Date().toISOString()
  const { data } = await (db.from as any)('page_comments')
    .update({ resolved: true, resolved_by: user.value?.id ?? null, resolved_at: stamp })
    .eq('id', c.id).select().single()
  if (data) {
    const i = comments.value.findIndex(x => x.id === c.id)
    if (i >= 0) comments.value[i] = data
    if (viewing.value?.id === c.id) viewing.value = data
  }
}
async function reopenComment(c: any) {
  const { data } = await (db.from as any)('page_comments')
    .update({ resolved: false, resolved_by: null, resolved_at: null })
    .eq('id', c.id).select().single()
  if (data) {
    const i = comments.value.findIndex(x => x.id === c.id)
    if (i >= 0) comments.value[i] = data
    if (viewing.value?.id === c.id) viewing.value = data
  }
}
async function resolveAndClose() {
  if (viewing.value) await resolveComment(viewing.value)
  viewOpen.value = false
}
async function reopenAndClose() {
  if (viewing.value) await reopenComment(viewing.value)
  viewOpen.value = false
}
// Hard delete — gated to the builder (developer role) only. Wipes the
// comment plus any replies pinned underneath it, with no soft-delete
// trail since prototype review noise shouldn't accumulate.
async function deleteComment(c: any) {
  if (!isDeveloper.value) return
  if (!confirm('Delete this comment? This cannot be undone.')) return
  await (db.from as any)('page_comments').delete().or(`id.eq.${c.id},parent_id.eq.${c.id}`)
  comments.value = comments.value.filter(x => x.id !== c.id && x.parent_id !== c.id)
  if (viewing.value?.id === c.id) viewOpen.value = false
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
