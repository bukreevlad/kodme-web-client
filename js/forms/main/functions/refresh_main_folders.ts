// Импортируем config
import { MAIN_FOLDERS_PAGE_SIZE } from "../../../config/constants.js";

// Импортируем utils
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем requests
import { getFoldersRequest } from "../../main-folders-manager/requests/get_folders.js";

// Импортируем functions
import { addFolderTab } from "./add_folder_tab.js";
import { removeFolderTab } from "./remove_folder_tab.js";

// Импортируем типы
import { isRecord } from "../types.js";
import type { Main } from "../index.js";
import type { MainFolder } from "../types.js";

/**
 * ***************************************************************************
 * Перечитать список папок пользователя и применить его к сессии и вкладкам
 * главной формы: удалённые папки убираются, новые добавляются. Панели
 * переживающих папок не пересоздаются — в них лежат строки каналов.
 *
 * Полный снапшот для too_long личной ленты: события папок в отрезанном
 * участке теряются, заменяются перечитом. Ошибка пробрасывается вызывающему
 * (в too_long ловится и логируется — точка фиксируется в любом случае).
 * ***************************************************************************
 */
export async function refreshMainFolders(): Promise<void> {

    // Собираем все страницы списка папок (курсор — как в менеджере папок)
    const folders: MainFolder[] = [];
    let cursorId: string | undefined = undefined;

    // Цикл страниц
    for (;;) {

        // Запрос страницы
        const response = await getFoldersRequest({
            direction: "next",
            ...(cursorId && { cursor_id: cursorId }),
            offset: MAIN_FOLDERS_PAGE_SIZE
        });
        if (!response.status || !Array.isArray(response.data)) break;

        // Валидные записи: id и name обязательны для вкладки
        for (const folder of response.data) {
            if (folder?.id && folder?.name) folders.push({ id: folder.id, name: folder.name });
        }

        // Конец списка: продолжения нет либо курсор замкнулся
        const lastId = response.data.at(-1)?.id;
        if (!response.has_more || !lastId || lastId === cursorId) break;
        cursorId = lastId;

    }

    // Сессия: поле user — unknown на границе localStorage
    const user: unknown = LocalStorage.session?.user;
    if (isRecord(user)) user.main_folders = folders;
    LocalStorage.updateSession(LocalStorage.session);

    // Дифф вкладок главной формы
    const main = FormsRegistry.getOwner<Main>("main");
    if (!main) return;

    // Убираем вкладки папок, исчезнувших из списка («Все» живёт всегда)
    const tabIds = (main.foldersTabs?.tabLinksElements ?? [])
        .map(link => link.getAttribute("data-target"))
        .filter((id): id is string => typeof id === "string" && id !== "");
    for (const id of tabIds) {
        if (id === "all") continue;
        if (!folders.some(folder => folder.id === id)) removeFolderTab(main, id);
    }

    // Добавляем новые папки (addFolderTab защищён от дубликатов)
    for (const folder of folders) {
        const exists = main.foldersTabs?.tabLinksElements.some(link => link.getAttribute("data-target") === folder.id);
        if (!exists) addFolderTab(main, folder);
    }

}
