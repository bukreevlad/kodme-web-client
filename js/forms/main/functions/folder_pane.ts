// Импортируем utils
import { FormsRegistry } from "../../../core/managers/forms_registry.js";

// Импортируем components
import { ChannelItem } from "../components/channel.js";

// Импортируем functions
import { sortChatListVisually } from "./sort_chat_list.js";

// Импортируем типы
import type { Main } from "../index.js";
import type { ChannelRecord } from "../types.js";

/**
 * ***************************************************************************
 * Добавляем канал в панель указанной папки.
 * Строка создаётся тем же компонентом, что и при обычной загрузке списка,
 * поэтому сразу появляется в папке без перезагрузки.
 * @param folderId - Id папки.
 * @param data - Данные канала.
 * ***************************************************************************
 */
export function addChannelToFolderPane(folderId: string, data: ChannelRecord): void {

    // Главная форма и её стор — источник строки; без них вставлять нечего
    const main = FormsRegistry.getOwner<Main>("main");
    const store = main?.store;
    if (!main || !store) return;

    // Панель папки и её список
    const pane = main.foldersTabs?.getPane(folderId);
    const list = pane?.querySelector<HTMLElement>("[data-list]");

    // Если панели нет или канал в ней уже отображается
    if (!list || list.querySelector(`[data-id="${data.id}"]`)) return;

    // Создаём строку канала
    const row = new ChannelItem(main, data);

    // Вставляем строку в список папки
    list.appendChild(row.element);

    // Визуально сортируем список папки (FLIP-анимация, как при активации вкладки)
    sortChatListVisually(list, store);

}

/**
 * ***************************************************************************
 * Убираем канал из панели указанной папки.
 * @param folderId - Id папки.
 * @param data - Данные канала.
 * ***************************************************************************
 */
export function removeChannelFromFolderPane(folderId: string, data: ChannelRecord): void {

    // Панель папки и её список
    const pane = FormsRegistry.getOwner<Main>("main")?.foldersTabs?.getPane(folderId);
    const list = pane?.querySelector<HTMLElement>("[data-list]");

    // Строка канала в списке папки
    const row = list?.querySelector<HTMLElement>(`[data-id="${data.id}"]`);
    if (!row) return;

    // Снимаем DOM-копию: стор убирает элемент и чистит свой реестр
    FormsRegistry.getOwner<Main>("main")?.store.removeDomElement(data.id, row);

}
