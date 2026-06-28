<script setup lang="ts">
import { computed } from 'vue'
import TextFileIcon from '@/assets/icons/TextFile.svg'
import RegularFileIcon from '@/assets/icons/RgularFile.svg'

// Mirrors `MARKDOWN_EXTENSIONS` in `common/filesystem/paths.ts` and the
// preload bridge. Inlined here (instead of importing from `common`) because
// `common/filesystem/paths` pulls in `fs`/`fs/promises`, which are not
// available in the sandboxed renderer.
const MARKDOWN_EXTENSIONS = [
  'markdown',
  'mdown',
  'mkdn',
  'md',
  'mkd',
  'mdwn',
  'mdtxt',
  'mdtext',
  'mdx',
  'text',
  'txt'
] as const

const hasMarkdownExtension = (filename: string): boolean => {
  if (!filename || typeof filename !== 'string') return false
  return MARKDOWN_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(`.${ext}`))
}

const props = defineProps<{
  name: string
}>()

// Markdown-family extensions use the text-file glyph; everything else falls
// back to the regular-file glyph.
const isTextFile = computed<boolean>(() => hasMarkdownExtension(props.name))
</script>

<template>
  <text-file-icon
    v-if="isTextFile"
    class="file-icon"
    aria-hidden="true"
  />
  <regular-file-icon
    v-else
    class="file-icon"
    aria-hidden="true"
  />
</template>

<style scoped>
.file-icon {
  flex-shrink: 0;
  display: block;
  width: 16px;
  height: 16px;
  margin-right: 5px;
  overflow: visible;
  /* SVG glyphs ship with a fixed muted gray fill (#9aa0a6) for a calmer,
   * theme-independent file-tree appearance; remove `color` overrides here. */
}
</style>
