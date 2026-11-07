// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { sortChatListVisually } from "./sort_chat_list.js";
import { addFolderTab } from "./add_folder_tab.js";
import { getSessionMainFolders } from "./session_identity.js";
import { templateHorizontalTab, templatePane } from "./folder_tab_templates.js";

// Импортируем типы
import type { Main } from "../index.js";
import type { MainFolder } from "../types.js";

/**
 * ***************************************************************************
 * Отобразить папки пользователя на главной форме:
 * общую папку «Все» и папки пользователя.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function showMainFolders(form: Main): void {

    try {

        // Получаем папки пользователя
        const folders = getSessionMainFolders();

        // Показываем общую папку
        const mainFolder: MainFolder = { id: "all", name: "Все" };
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

                // Добавляем папки в табы
                addFolderTab(form, folder);

            });

        } else {

            // Скрываем папки
            form.foldersTabs?.toggleNavigation(true);

        }

    } catch (error) {
        Logger.error("Ошибка при отображении папок", error);
    }

}
