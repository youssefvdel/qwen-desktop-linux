/**
 * Skills Manager — system prompt injection for chat.qwen.ai
 *
 * Skills are .md/.txt files stored in ~/.config/qwen-desktop-linux/skills/.
 * Each skill contains a system prompt that gets injected into the chat input
 * when selected from the Skills menu.
 *
 * Key features:
 * - injectSkill() injects via executeJavaScript with React nativeInputValueSetter
 *   pattern, plus MutationObserver fallback for late-rendered inputs
 * - buildSkillsMenuTemplate() returns menu items for pre-build inclusion
 *   (avoids Electron's immutable post-build menu issue)
 */
import { MenuItemConstructorOptions } from "electron";
/**
 * Ensure the skills directory exists, creating it and a sample skill if absent.
 */
export declare function ensureSkillsDir(): void;
/**
 * Return the filenames of all available skills (*.md or *.txt).
 */
export declare function getAvailableSkills(): Promise<string[]>;
/**
 * Read a skill file and inject its content into the chat input of the main
 * window. Handles both plain textareas and React-controlled inputs via the
 * nativeInputValueSetter pattern, as well as contenteditable divs. Falls back
 * to a MutationObserver that retries for up to 3 seconds if no element is
 * found on the first pass.
 */
export declare function injectSkill(skillName: string, getMainWindow: () => Electron.BrowserWindow | null): Promise<void>;
/**
 * Open the skills directory in the system file manager.
 */
export declare function openSkillsFolder(getMainWindow: () => Electron.BrowserWindow | null): void;
/**
 * Build the menu-item template for the Skills submenu. Returns an array of
 * MenuItemConstructorOptions that should be spread into the submenu template
 * at menu-build time — avoiding the bug of mutating Electron menus after
 * Menu.buildFromTemplate().
 */
export declare function buildSkillsMenuTemplate(getMainWindow: () => Electron.BrowserWindow | null): Promise<MenuItemConstructorOptions[]>;
//# sourceMappingURL=skills-manager.d.ts.map