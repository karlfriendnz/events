<template>
  <!-- Sport-themed mode: SVG court markings as the background, with the
       section dividers drawn over the top in translucent white. Falls back
       to the plain emerald look when courtType isn't set (used by the venue
       map / older callers). -->
  <div v-if="courtType" class="relative overflow-hidden rounded-md"
    :class="bg.outerClass">
    <svg viewBox="0 0 200 120" preserveAspectRatio="none"
      class="absolute inset-0 w-full h-full"
      fill="none" :stroke="bg.lineColor" stroke-width="1.4">

      <!-- Sport markings (rendered first → behind the section dividers) -->
      <template v-if="courtType === 'tennis'">
        <rect x="6"  y="6"  width="188" height="108" />
        <rect x="6"  y="22" width="188" height="76"  />
        <line x1="100" y1="6"  x2="100" y2="22"  />
        <line x1="100" y1="98" x2="100" y2="114" />
        <line x1="100" y1="22" x2="100" y2="98"  stroke-dasharray="3 3" />
      </template>

      <template v-else-if="courtType === 'basketball'">
        <rect x="6" y="6" width="188" height="108" />
        <line x1="100" y1="6" x2="100" y2="114" />
        <circle cx="100" cy="60" r="14" />
        <!-- Keys -->
        <rect x="6"  y="36" width="36" height="48" />
        <rect x="158" y="36" width="36" height="48" />
        <!-- Three-point arcs (approx) -->
        <path d="M 42 24 Q 70 60 42 96" />
        <path d="M 158 24 Q 130 60 158 96" />
      </template>

      <template v-else-if="courtType === 'netball'">
        <rect x="6" y="6" width="188" height="108" />
        <!-- Thirds -->
        <line x1="68"  y1="6" x2="68"  y2="114" />
        <line x1="132" y1="6" x2="132" y2="114" />
        <!-- Goal circles -->
        <path d="M 6 30 Q 38 60 6 90" />
        <path d="M 194 30 Q 162 60 194 90" />
        <circle cx="100" cy="60" r="6" />
      </template>

      <template v-else-if="courtType === 'football'">
        <rect x="6" y="6" width="188" height="108" />
        <line x1="100" y1="6" x2="100" y2="114" />
        <circle cx="100" cy="60" r="16" />
        <!-- Penalty boxes -->
        <rect x="6"   y="30" width="24" height="60" />
        <rect x="170" y="30" width="24" height="60" />
        <!-- Goal areas -->
        <rect x="6"   y="46" width="10" height="28" />
        <rect x="184" y="46" width="10" height="28" />
        <!-- Goalposts -->
        <line x1="3" y1="52" x2="3" y2="68" stroke-width="2" />
        <line x1="197" y1="52" x2="197" y2="68" stroke-width="2" />
      </template>

      <template v-else-if="courtType === 'cricket'">
        <!-- Grass background border (the cage outer line) -->
        <rect x="6" y="6" width="188" height="108" />
        <!-- Bowler run-up zone at the left edge -->
        <line x1="20" y1="6" x2="20" y2="114" stroke-dasharray="2 3" opacity="0.45" />
        <!-- Per-lane batting strips (orange/tan) running the length of each
             tunnel. Sections > 1 means a multi-net facility — draw one
             strip per lane; otherwise a single strip down the middle. -->
        <g :stroke="bg.pitchColor" stroke-width="6" stroke-linecap="butt">
          <line v-if="sections <= 1"
            x1="32" y1="60" x2="184" y2="60" />
          <template v-else>
            <line v-for="i in sections" :key="`p-${i}`"
              x1="32"
              :y1="6 + ((i - 0.5) * (108 / sections))"
              x2="184"
              :y2="6 + ((i - 0.5) * (108 / sections))" />
          </template>
        </g>
        <!-- Crease marks at each end of every batting strip -->
        <g stroke-width="1.4">
          <template v-if="sections <= 1">
            <line x1="32"  y1="55" x2="32"  y2="65" />
            <line x1="184" y1="55" x2="184" y2="65" />
          </template>
          <template v-else>
            <template v-for="i in sections" :key="`c-${i}`">
              <line :x1="32"  :y1="6 + ((i - 0.5) * (108 / sections)) - 4"
                    :x2="32"  :y2="6 + ((i - 0.5) * (108 / sections)) + 4" />
              <line :x1="184" :y1="6 + ((i - 0.5) * (108 / sections)) - 4"
                    :x2="184" :y2="6 + ((i - 0.5) * (108 / sections)) + 4" />
            </template>
          </template>
        </g>
      </template>

      <template v-else-if="courtType === 'squash'">
        <rect x="6" y="6" width="188" height="108" />
        <!-- Tin / service line -->
        <line x1="6" y1="38" x2="194" y2="38" stroke-width="2" />
        <line x1="6" y1="86" x2="194" y2="86" />
        <!-- Service boxes -->
        <rect x="6"   y="38" width="40" height="48" />
        <rect x="154" y="38" width="40" height="48" />
        <line x1="100" y1="86" x2="100" y2="114" />
      </template>

      <template v-else-if="courtType === 'pool'">
        <rect x="6" y="6" width="188" height="108" />
        <!-- 5 lane dividers (decorative — actual lane count comes from sections) -->
        <line v-for="i in 5" :key="i"
          x1="6" :y1="6 + (i * 18)" x2="194" :y2="6 + (i * 18)" stroke-dasharray="6 4" opacity="0.4" />
      </template>

      <template v-else-if="courtType === 'hall'">
        <rect x="6" y="6" width="188" height="108" />
        <!-- Suggestion of a badminton-court overlay -->
        <line x1="50"  y1="6" x2="50"  y2="114" opacity="0.45" />
        <line x1="100" y1="6" x2="100" y2="114" opacity="0.45" />
        <line x1="150" y1="6" x2="150" y2="114" opacity="0.45" />
        <line x1="6" y1="60" x2="194" y2="60" opacity="0.45" />
      </template>

      <template v-else-if="courtType === 'studio'">
        <rect x="6" y="6" width="188" height="108" />
        <!-- Mirror suggestion (back wall) -->
        <line x1="6" y1="14" x2="194" y2="14" stroke-dasharray="2 2" opacity="0.4" />
        <line x1="6" y1="22" x2="194" y2="22" stroke-dasharray="2 2" opacity="0.4" />
      </template>

      <template v-else>
        <!-- Generic — just an outline -->
        <rect x="6" y="6" width="188" height="108" />
      </template>

      <!-- Section dividers — overlaid above the sport markings.
           For 'rows' (pool lanes) we draw horizontal lines, for 'cols'
           vertical lines, for 'grid' both. -->
      <template v-if="!regions?.length && sections > 1">
        <template v-if="orientation === 'rows'">
          <line v-for="i in (sections - 1)" :key="`sep-r-${i}`"
            :x1="6" :y1="6 + (i * (108 / sections))"
            :x2="194" :y2="6 + (i * (108 / sections))"
            stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="1.6" stroke-linecap="round" />
        </template>
        <template v-else-if="orientation === 'grid'">
          <line v-for="i in (Math.ceil(sections / 2)) - 1" :key="`sep-gh-${i}`"
            :x1="6" :y1="6 + (i * (108 / Math.ceil(sections / 2)))"
            :x2="194" :y2="6 + (i * (108 / Math.ceil(sections / 2)))"
            stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="1.6" stroke-linecap="round" />
          <line x1="100" y1="6" x2="100" y2="114"
            stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="1.6" stroke-linecap="round" />
        </template>
        <template v-else>
          <line v-for="i in (sections - 1)" :key="`sep-c-${i}`"
            :x1="6 + (i * (188 / sections))" :y1="6"
            :x2="6 + (i * (188 / sections))" :y2="114"
            stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="1.6" stroke-linecap="round" />
        </template>
      </template>
    </svg>
  </div>

  <!-- Plain mode: irregular regions in normalised 0..1 space. -->
  <div v-else-if="regions && regions.length"
    class="bg-emerald-200/70 rounded-md relative overflow-hidden">
    <div v-for="(r, i) in regions" :key="i"
      class="absolute bg-emerald-300/80 border border-emerald-400/40 rounded-[2px]"
      :style="{
        left: `${r.x * 100}%`,
        top: `${r.y * 100}%`,
        width: `${r.w * 100}%`,
        height: `${r.h * 100}%`,
      }" />
  </div>

  <!-- Plain grid orientation — wraps into 2 columns (4 sections = 2×2, 6 = 2×3 …). -->
  <div v-else-if="orientation === 'grid'"
    class="bg-emerald-200/70 rounded-md grid grid-cols-2 overflow-hidden gap-px">
    <div v-for="i in sections" :key="i" class="bg-emerald-300/80" />
  </div>

  <!-- Plain single-axis strips. -->
  <div v-else
    class="bg-emerald-200/70 rounded-md flex items-stretch overflow-hidden gap-px"
    :class="orientation === 'rows' ? 'flex-col' : ''">
    <div v-for="i in sections" :key="i"
      class="flex-1 bg-emerald-300/80"
      :class="orientation === 'rows'
        ? 'first:rounded-t-md last:rounded-b-md'
        : 'first:rounded-l-md last:rounded-r-md'" />
  </div>
</template>

<script setup lang="ts">
interface Region { x: number; y: number; w: number; h: number }
const props = withDefaults(defineProps<{
  sections?: number
  regions?: Region[]
  orientation?: 'cols' | 'rows' | 'grid'
  /** Sport key (matches the LIBRARY type in VenueLibraryDialog).
   *  When set, the diagram renders sport-specific court markings. */
  courtType?: string | null
}>(), {
  sections: 1,
  regions: undefined,
  orientation: 'cols',
  courtType: null,
})

// Per-sport color palette. outerClass is a Tailwind background class for the
// container; lineColor is the SVG stroke color for markings. pitchColor is
// used by sports that have an inner area (cricket pitch, etc.).
const PALETTE: Record<string, { outerClass: string; lineColor: string; pitchColor?: string }> = {
  tennis:     { outerClass: 'bg-emerald-600/85',                                  lineColor: '#FFFFFF' },
  basketball: { outerClass: 'bg-amber-700/80',                                    lineColor: '#FFE7C2' },
  netball:    { outerClass: 'bg-orange-600/85',                                   lineColor: '#FFFFFF' },
  football:   { outerClass: 'bg-emerald-700/85',                                  lineColor: '#FFFFFF' },
  cricket:    { outerClass: 'bg-emerald-700/85',                                  lineColor: '#FFFFFF', pitchColor: '#C9A57B' },
  squash:     { outerClass: 'bg-amber-100',                                       lineColor: '#9A6B2B' },
  pool:       { outerClass: 'bg-sky-500/80',                                      lineColor: '#E0F2FE' },
  hall:       { outerClass: 'bg-amber-200',                                       lineColor: '#9A6B2B' },
  studio:     { outerClass: 'bg-amber-100',                                       lineColor: '#B27D38' },
  generic:    { outerClass: 'bg-emerald-300/70',                                  lineColor: '#FFFFFF' },
}

const bg = computed(() =>
  (props.courtType && PALETTE[props.courtType]) || PALETTE.generic,
)
</script>
