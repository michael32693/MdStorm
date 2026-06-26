import {
  SEPARATOR,
  getNewFile,
  getNewDirectory,
  getCOPY,
  getCUT,
  getPASTE,
  getRENAME,
  getDELETE,
  getShowInFolder
} from './menuItems'
import { popupContextMenu, type ContextMenuItem } from '../popupMenu'

export type SideBarTargetType = 'file' | 'folder'

export const showContextMenu = (
  event: { clientX: number; clientY: number },
  hasPathCache: boolean,
  targetType: SideBarTargetType
): void => {
  // Folders offer create/new-file/new-directory; files do not.
  const contextItems: ContextMenuItem[] =
    targetType === 'folder'
      ? [
          getNewFile(),
          getNewDirectory(),
          SEPARATOR,
          getCOPY(),
          getCUT(),
          getPASTE(),
          SEPARATOR,
          getRENAME(),
          getDELETE(),
          SEPARATOR,
          getShowInFolder()
        ]
      : [
          getCOPY(),
          getCUT(),
          SEPARATOR,
          getRENAME(),
          getDELETE(),
          SEPARATOR,
          getShowInFolder()
        ]

  // PASTE entry toggles based on the cached source path. In the folder
  // menu it lives at index 5; in the file menu (no create entries) it is
  // absent — pasting targets the active directory, which only folders
  // represent.
  if (targetType === 'folder') {
    contextItems[5].enabled = hasPathCache
  }

  const items: ContextMenuItem[] = contextItems.map((item) => {
    if (!item || item.type === 'separator') return item
    const click = item.click
    return {
      ...item,
      click: click ? () => click(null, null) : undefined
    }
  })

  popupContextMenu(items, { x: event.clientX, y: event.clientY })
}
