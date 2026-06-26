import path from 'path'
import { BrowserWindow, ipcMain } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import { electronLocalshortcut } from '@hfelix/electron-localshortcut'
import BaseWindow, { WindowLifecycle, WindowType, type EnvLike, type PreferenceLike } from './base'
import type Accessor from '../app/accessor'
import { centerWindowOptions } from './utils'
import { TITLE_BAR_HEIGHT, preferencesWinOptions, isLinux, isOsx } from '../config'
import log from 'electron-log'

interface ParentWindowBlockState {
  movable: boolean
  closable: boolean
  minimizable: boolean
  maximizable: boolean
}

class SettingWindow extends BaseWindow {
  /**
   * @param accessor The application accessor for application instances.
   */
  constructor(accessor: Accessor) {
    super(accessor)
    this.type = WindowType.SETTINGS
  }

  /**
   * Creates a new setting window.
   *
   * @param category The settings category tab name.
   * @param parentWindow The parent editor window to block while open.
   */
  createWindow(category: string | null = null, parentWindow?: BrowserWindow): BrowserWindow {
    const { menu: appMenu, env, keybindings, preferences } = this._accessor
    const winOptions: BrowserWindowConstructorOptions = Object.assign({}, preferencesWinOptions)
    const parent = parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined
    let parentBlockState: ParentWindowBlockState | null = null
    centerWindowOptions(
      winOptions as BrowserWindowConstructorOptions & {
        width: number
        height: number
        x?: number
        y?: number
      }
    )
    if (isLinux) {
      winOptions.icon = path.join(
        (global as unknown as { __static: string }).__static,
        'logo-96px.png'
      )
    }

    if (parent) {
      winOptions.parent = parent
      // Native modal windows block the parent on Windows/Linux. On macOS they
      // become sheets, which do not match the preference window chrome.
      winOptions.modal = !isOsx
    }

    // WORKAROUND: Electron has issues with different DPI per monitor when
    // setting a fixed window size.
    winOptions.resizable = true

    // Enable native or custom/frameless window and titlebar.
    const { titleBarStyle, theme } = preferences.getAll()
    if (!isOsx) {
      winOptions.titleBarStyle = 'default'
      if (titleBarStyle === 'native') {
        winOptions.frame = true
      }
    }

    winOptions.backgroundColor = this._getPreferredBackgroundColor(theme)
    let win: BrowserWindow | null = (this.browserWindow = new BrowserWindow(winOptions))

    if (isOsx) {
      win.setWindowButtonVisibility(true)
    }

    if (parent && !parent.isDestroyed()) {
      if (isOsx) {
        parentBlockState = {
          movable: parent.isMovable(),
          closable: parent.isClosable(),
          minimizable: parent.isMinimizable(),
          maximizable: parent.isMaximizable()
        }
        parent.setMovable(false)
        parent.setClosable(false)
        parent.setMinimizable(false)
        parent.setMaximizable(false)
      }
      parent.webContents.send('mt::window-child-modal-state', true)
    }

    win.webContents.on('did-fail-load', (_event, code, desc, url) => {
      log.error(`did-fail-load ${code} ${desc} @ ${url}`)
    })
    win.webContents.on('render-process-gone', (_event, details) => {
      log.error(`render-process-gone: ${details.reason} (${details.exitCode})`)
    })

    this.id = win.id

    // Register a null menu entry so setActiveWindow doesn't crash. The
    // preference window has no application menu.
    appMenu.addSettingMenu(win)

    win.once('ready-to-show', () => {
      this.lifecycle = WindowLifecycle.READY
      this.emit('window-ready')
    })

    win.on('focus', () => {
      win!.webContents.send('mt::window-active-status', { status: true })
      parent?.webContents.send('mt::window-active-status', { status: true })
    })

    // Lost focus
    win.on('blur', () => {
      this.emit('window-blur')
      win!.webContents.send('mt::window-active-status', { status: false })
    })

    win.on('close', (event) => {
      this.emit('window-close')

      event.preventDefault()
      ipcMain.emit('window-close-by-id', win!.id)
    })

    // The window is now destroyed.
    win.on('closed', () => {
      this.emit('window-closed')

      if (parent && !parent.isDestroyed()) {
        if (parentBlockState) {
          parent.setMovable(parentBlockState.movable)
          parent.setClosable(parentBlockState.closable)
          parent.setMinimizable(parentBlockState.minimizable)
          parent.setMaximizable(parentBlockState.maximizable)
        }
        parent.webContents.send('mt::window-child-modal-state', false)
        parent.focus()
      }

      // Free window reference
      win = null
    })

    this.lifecycle = WindowLifecycle.LOADING
    win.loadURL(this._buildUrlString(this.id, env, preferences, category))
    win.setSheetOffset(TITLE_BAR_HEIGHT)

    const devToolsAccelerator = keybindings.getAccelerator('view.toggle-dev-tools')
    if (env.debug && devToolsAccelerator) {
      electronLocalshortcut.register(win, devToolsAccelerator, () => {
        win!.webContents.toggleDevTools()
      })
    }
    return win
  }

  protected override _buildUrlString(
    windowId: number | null,
    env: EnvLike,
    userPreference: PreferenceLike,
    category?: string | null
  ): string {
    const url = this._buildUrlWithSettings(windowId, env, userPreference)
    if (category) {
      // Overwrite type to add category name
      url.searchParams.set('type', `${WindowType.SETTINGS}/${category}`)
    }
    return url.toString()
  }
}

export default SettingWindow
