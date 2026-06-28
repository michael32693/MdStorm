<template>
  <div class="tree-view">
    <div class="title">
      <!-- Placeholder -->
    </div>

    <!-- Project tree view -->
    <div
      v-if="projectTree"
      class="project-tree"
    >
      <div
        ref="projectTitleEl"
        class="title"
        @contextmenu="handleProjectContextMenu"
      >
        <button
          type="button"
          class="icon-arrow-button"
          :class="showDirectories ? 'icon-arrow-expanded' : 'icon-arrow-collapsed'"
          aria-label="Toggle project folder"
          @click.stop="toggleDirectories()"
        >
          <component
            :is="showDirectories ? CollapseDownIcon : CollapseRightIcon"
            class="icon-arrow"
            aria-hidden="true"
          />
        </button>
        <span
          class="default-cursor text-overflow"
          @click.stop="toggleDirectories()"
        >{{
          projectTree.name
        }}</span>
      </div>
      <div
        v-show="showDirectories"
        class="tree-wrapper"
      >
        <folder
          v-for="folder of projectTree.folders"
          :key="folder.id"
          :folder="folder"
          :depth="depth"
        />
        <input
          v-show="createCacheDirname === projectTree.pathname"
          ref="input"
          v-model="createName"
          :placeholder="isCreateFile ? 'Enter .md file name' : ''"
          type="text"
          class="new-input"
          :style="{ 'margin-left': `${depth * 20 + 34}px` }"
          @keypress.enter="handleInputEnter"
        >
        <file
          v-for="file of projectTree.files"
          :key="file.id"
          :file="file"
          :depth="depth"
        />
        <div
          v-if="
            projectTree.files.length === 0 &&
              projectTree.folders.length === 0 &&
              createCacheDirname !== projectTree.pathname
          "
          class="empty-project"
        >
          <span>{{ t('sideBar.tree.emptyProject') }}</span>
          <div class="centered-group">
            <button
              class="button-primary"
              @click.stop="createFile"
            >
              {{ t('sideBar.tree.createFile') }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else
      class="open-project"
    >
      <div class="centered-group">
        <el-button
          text
          bg
          type="primary"
          @click="openFolder"
        >
          {{ t('sideBar.tree.openFolder') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/store/project'
import Folder from './treeFolder.vue'
import File from './treeFile.vue'
import bus from '../../bus'
import { useI18n } from 'vue-i18n'
import { showContextMenu } from '../../contextMenu/sideBar'
import CollapseDownIcon from '@/assets/icons/CollapseDown.svg'
import CollapseRightIcon from '@/assets/icons/CollapseRight.svg'
import type { TreeNode } from './types'

const { t } = useI18n()

const props = defineProps<{
  // The project store seeds `projectTree` as `null` until a folder is
  // opened; the template renders the "open project" empty-state behind
  // `v-if="projectTree"`. Type the prop nullable to match runtime + the
  // template guard.
  projectTree: TreeNode | null
}>()

const depth = 0
const showDirectories = ref(true)
const createName = ref('')
const input = ref<HTMLInputElement | null>(null)
const projectTitleEl = ref<HTMLDivElement | null>(null)

const projectStore = useProjectStore()

// Computed properties
const { createCache } = storeToRefs(projectStore)
const { clipboard } = storeToRefs(projectStore)

// The createCache state is `{ dirname, type }` while an input is shown, and
// `{}` otherwise. Expose a typed accessor for the template so we don't have
// to thread `as any` through every comparison.
const createCacheDirname = computed<string | undefined>(() => {
  const cache = createCache.value as { dirname?: string }
  return cache.dirname
})
const isCreateFile = computed<boolean>(() => {
  const cache = createCache.value as { type?: string }
  return cache.type === 'file'
})

// Methods
const openFolder = (): void => {
  projectStore.ASK_FOR_OPEN_PROJECT()
}

const createFile = (): void => {
  projectStore.CHANGE_ACTIVE_ITEM(props.projectTree)
  bus.emit('SIDEBAR::new', 'file')
}

const toggleDirectories = (): void => {
  showDirectories.value = !showDirectories.value
}

const handleProjectContextMenu = (event: MouseEvent): void => {
  event.preventDefault()
  if (!props.projectTree) return
  projectStore.CHANGE_ACTIVE_ITEM(props.projectTree)
  showContextMenu(event, !!clipboard.value, 'folder')
}

// From createFileOrDirectoryMixins
const handleInputFocus = (): void => {
  if (createCacheDirname.value !== props.projectTree?.pathname) return
  showDirectories.value = true

  const isFile = isCreateFile.value
  nextTick(() => {
    if (!input.value) return
    input.value.focus()
    // Prefill `.md` for file creation so the caret lands just before the
    // dot — typing the base name then Enter keeps the markdown extension.
    createName.value = isFile ? '.md' : ''
    if (isFile) {
      // Wait for the DOM flush after the v-model write; calling
      // setSelectionRange before the value lands would have the caret reset to
      // the end once Vue's patch applies the new value.
      nextTick(() => input.value?.setSelectionRange(0, 0))
    }
  })
}

const handleInputEnter = (): void => {
  projectStore.CREATE_FILE_DIRECTORY(createName.value)
}

onMounted(() => {
  bus.on('SIDEBAR::show-new-input', handleInputFocus)

  // Hide rename / create inputs on outside clicks. Buttons that open these
  // inputs must use @click.stop so their click never reaches this listener.
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (target && target.tagName !== 'INPUT') {
      projectStore.CHANGE_ACTIVE_ITEM({})
      projectStore.createCache = {}
      projectStore.renameCache = null
    }
  })

  document.addEventListener('contextmenu', (event) => {
    const target = event.target as HTMLElement | null
    if (target && target.tagName !== 'INPUT') {
      projectStore.createCache = {}
      projectStore.renameCache = null
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      projectStore.createCache = {}
      projectStore.renameCache = null
    }
  })
})
</script>

<style scoped>
.list-item {
  display: inline-block;
  margin-right: 10px;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.2s;
}
.list-enter, .list-leave-to
  /* .list-leave-active for below version 2.1.8 */ {
  opacity: 0;
  transform: translateX(-50px);
}
.tree-view {
  font-size: 14px;
  color: var(--sideBarColor);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.tree-view > .title {
  height: 35px;
  line-height: 35px;
  padding: 0 15px;
  display: flex;
  flex-shrink: 0;
  flex-direction: row-reverse;
}

.icon-arrow-button {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 24px;
  height: 30px;
  padding: 0;
  border: 0;
  margin: 0;
  background: transparent;
  cursor: pointer;
  color: inherit;
}
.icon-arrow-button:focus-visible {
  outline: 1px solid var(--highlightThemeColor);
  outline-offset: -3px;
}
.icon-arrow {
  display: block;
  width: 12px;
  height: 12px;
  overflow: visible;
  pointer-events: none;
  position: relative;
  top: -1px;
}
.icon-arrow-collapsed {
  color: color-mix(in srgb, var(--sideBarTextColor), var(--sideBarBgColor) 45%);
}
.icon-arrow-expanded {
  color: var(--sideBarTextColor);
}

.folder-icon {
  flex-shrink: 0;
  display: block;
  width: 16px;
  height: 16px;
  margin-right: 5px;
  color: #b27c00;
}

.project-tree {
  display: flex;
  flex-direction: column;
  overflow: auto;
  flex: 1;
}

.project-tree > .title {
  height: 30px;
  font-size: 14px;
  padding-right: 15px;
  display: flex;
  align-items: center;
}

.project-tree > .title > span {
  flex: 1;
  user-select: none;
}

.project-tree > .title > a {
  pointer-events: auto;
  cursor: pointer;
  margin-left: 8px;
  color: var(--sideBarIconColor);
  opacity: 0;
}

.project-tree > .title > a:hover {
  color: var(--highlightThemeColor);
}

.project-tree > .title > a.active {
  color: var(--highlightThemeColor);
}

.project-tree > .tree-wrapper {
  overflow: auto;
  flex: 1;
}

.project-tree > .tree-wrapper::-webkit-scrollbar:vertical {
  width: 8px;
}
.project-tree div.title:hover > a {
  opacity: 1;
}
.default-cursor {
  cursor: pointer;
}
.open-project {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  align-items: center;
  padding-bottom: 100px;
}

.open-project .centered-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.open-project .el-button {
  margin-top: 20px;
}
.open-project .el-button.is-text.is-has-bg,
.empty-project .el-button.is-text.is-has-bg {
  background-color: var(--itemBgColor);
  color: var(--themeColor);
  border-color: transparent;
}
.open-project .el-button.is-text.is-has-bg:hover,
.open-project .el-button.is-text.is-has-bg:focus,
.empty-project .el-button.is-text.is-has-bg:hover,
.empty-project .el-button.is-text.is-has-bg:focus {
  background-color: var(--floatHoverColor);
  color: var(--themeColor);
}
.new-input {
  outline: none;
  height: 22px;
  margin: 5px 0;
  padding: 0 6px;
  color: var(--sideBarColor);
  border: 1px solid var(--floatBorderColor);
  background: var(--inputBgColor);
  width: calc(100% - 45px);
  border-radius: 3px;
}
.tree-wrapper {
  position: relative;
}
.empty-project {
  font-size: 14px;
  display: flex;
  flex-direction: column;
  padding-top: 40px;
  align-items: center;
  color: var(--sideBarTextColor);
  & button {
    margin-top: 10px;
  }
}

.empty-project > a {
  color: var(--highlightThemeColor);
  text-align: center;
  margin-top: 15px;
  text-decoration: none;
}
.bold {
  font-weight: 600;
}
</style>
