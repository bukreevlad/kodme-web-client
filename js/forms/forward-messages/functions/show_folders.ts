// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем functions
import { addFolderTab } from "./add_folder_tab.js";
import { templateHorizontalTab, templatePane } from "./folder_tab_templates.js";
import { sortChatListVisually } from "../../main/functions/sort_chat_list.js";

// Импортируем типы
import type { MainFolder } from "../../main/types.js";
import type { ForwardMessages } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Отобразить папки пользователя на форме пересылки: общую папку «Все»
 * и папки пользователя (зеркало showMainFolders главной формы).
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function showForwardFolders(form: ForwardMessages): void {

    try {

        // Получаем папки пользователя
        const folders = getSessionFolders();

        // Показываем общую папку
        const mainFolder: MainFolder = { id: "all", name: t("forms.main.all_folder") };
        const tabH = templateHorizontalTab(mainFolder);
        const pane = templatePane(mainFolder);

        // Добавляем в табы
        form.foldersTabs?.addTab({
            id: "all",
            links: [tabH],
            pane: pane,
            onActivation: () => {

                // Визуальная сортировка каналов
                const currentList = pane?.querySelector<HTMLElement>("[data-list]");
                sortChatListVisually(currentList, form.store);

            }
        });
        form.foldersTabs?.activateTab("all");

        // Если папки есть
        if (folders.length > 0) {

            // Проходим по папкам
            folders.forEach(folder => {

                // Добавляем папку во вкладки
                addFolderTab(form, folder);

            });
        } else {

            // Скрываем папки
            form.foldersTabs?.toggleNavigation(true);

        }

    } catch (error) {
        Logger.error("[app][forward][show-folders]:", error);
    }

}

/**
 * ***************************************************************************
 * Папки пользователя из текущей сессии (зеркало getSessionMainFolders
 * главной формы; данные читаем с guard'ами — поле user в сессии типизировано
 * как неполный профиль).
 * @returns Массив папок (пустой, если папок нет или сессия неполная).
 * ***************************************************************************
 */
function getSessionFolders(): MainFolder[] {

    const user: unknown = LocalStorage.session?.user;
    if (!isRecord(user)) return [];

    const folders: unknown = user.main_folders;
    if (!Array.isArray(folders)) return [];

    return folders.filter(isMainFolder);

}

/**
 * Значение — папка главного экрана (id и название строками).
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на папку.
 */
function isMainFolder(value: unknown): value is MainFolder {

    return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";

}

/**
 * Значение — объект (runtime-guard для неизвестных данных сессии).
 * @param value - Проверяемое значение.
 * @returns true, если значение — объект.
 */
function isRecord(value: unknown): value is Record<string, unknown> {

    return typeof value === "object" && value !== null;

}
