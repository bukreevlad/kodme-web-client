// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { sortChatListVisually } from "./sort_chat_list.js";
import { templateHorizontalTab, templatePane } from "./folder_tab_templates.js";

// Импортируем типы
import type { Main } from "../index.js";
import type { MainFolder } from "../types.js";

/**
 * ***************************************************************************
 * Добавить папку во вкладки главной формы (лента папок в шапке).
 *
 * Вкладка попадает в общую ленту, а её список каналов сортируется
 * при активации — как и у общей папки «Все».
 * @param form - Экземпляр формы.
 * @param folder - Данные папки.
 * ***************************************************************************
 */
export function addFolderTab(form: Main, folder: MainFolder): void {

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
        Logger.error("Ошибка при добавлении папки", error);
    }

}
