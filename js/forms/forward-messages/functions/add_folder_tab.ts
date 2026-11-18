// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { sortChatListVisually } from "../../main/functions/sort_chat_list.js";
import { templateHorizontalTab, templatePane } from "./folder_tab_templates.js";

// Импортируем типы
import type { MainFolder } from "../../main/types.js";
import type { ForwardMessages } from "../index.js";

/**
 * ***************************************************************************
 * Добавить папку во вкладки формы пересылки (лента папок в шапке).
 *
 * Зеркало addFolderTab главной формы: вкладка попадает в общую ленту,
 * список её каналов сортируется при активации — как у папки «Все».
 * @param form - Экземпляр формы.
 * @param folder - Данные папки.
 * @returns void
 * ***************************************************************************
 */
export function addFolderTab(form: ForwardMessages, folder: MainFolder): void {

    try {

        // Защита от дубликатов
        const exists = form.foldersTabs?.tabLinksElements.some(link => link.getAttribute("data-target") === folder.id);
        if (exists) return;

        // Создаем табы и контент
        const tabH = templateHorizontalTab(folder);
        const pane = templatePane(folder);

        // Добавляем в табы
        form.foldersTabs?.addTab({
            id: folder.id,
            links: [tabH],
            pane: pane,
            onActivation: () => {

                // Визуальная сортировка каналов
                const currentList = pane?.querySelector<HTMLElement>("[data-list]");
                sortChatListVisually(currentList, form.store);

            }
        });

        // Показываем навигацию папок
        form.foldersTabs?.toggleNavigation(false);

    } catch (error) {
        Logger.error("[app][forward][add-folder-tab]:", error);
    }

}
