// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";
import { ChannelItem } from "../channel.js";

// Импортируем forms
import { Main } from "../../../main/index.js";
import { MainFoldersManager } from "../../../main-folders-manager/index.js";

// Импортируем requests
import { moveToFolderRequest } from "../../../messages/requests/move_to_folder.js";
import { unmoveFromFolderRequest } from "../../../messages/requests/unmove_from_folder.js";

// Импортируем functions
import { sortChatListVisually } from "../../functions/sort_chat_list.js";
import { updateFolderUnread } from "../../functions/update_folder_unread.js";

// Импортируем db
import { channelsTable } from "../../db.js";

// Импортируем типы
import type { ChannelRecord } from "../../types.js";

/**
 * Выбор папки в диалоге менеджера папок: канал добавляется в папку
 * (is_selected) либо убирается из неё.
 */
interface FolderSelection {

    /** Id папки. */
    id: string;

    /** Папка выбрана каналом (true) либо снимается с него (false). */
    is_selected?: boolean;

}

/**
 * ***************************************************************************
 * Добавление/удаление канала в папке.
 * @param channel - Строка канала.
 * ***************************************************************************
 */
export async function moveToFolderHandler(channel: ChannelItem): Promise<void> {

    try {

        // Отображаем форму выбора папки
        new MainFoldersManager({
            selectedFolders: channel?.data?.main_folders_ids || [],
            callback: async (folder: FolderSelection) => {
                if (folder && folder.id) {

                    try {

                        // Если папка выбрана
                        if (folder.is_selected) {

                            // Запрос
                            const response = await moveToFolderRequest({
                                channel_id: channel.data.id,
                                main_folder_id: folder.id
                            });

                            // Если запрос выполнен
                            if (response) {

                                // Обновляем данные канала (добавляем папку)
                                channel.data.main_folders_ids?.push(folder.id);
                                Main.instance?.store.update(channel.data.id, channel.data);

                                // Обновляем IndexedDB
                                await channelsTable().update(channel.data.id, {
                                    main_folders_ids: channel.data.main_folders_ids
                                });

                                // Добавляем канал в панель папки, чтобы он сразу появился
                                addChannelToFolderPane(folder.id, channel.data);

                                // Обновляем бейджи непрочитанных на вкладках папок
                                if (Main.instance) updateFolderUnread(Main.instance);

                                // Toast
                                Toast.success(window._lc.forms.main.components.channels.context_menu.toasts.success_move_to_folder, {
                                    position: "bottom-center"
                                });

                            }

                            // Если папка не выбрана
                        } else {

                            // Запрос
                            const response = await unmoveFromFolderRequest({
                                channel_id: channel.data.id,
                                main_folder_id: folder.id
                            });

                            // Если запрос выполнен
                            if (response) {

                                // Обновляем данные канала (убираем папку)
                                const filteredFolders = (channel.data.main_folders_ids || []).filter(f => f !== folder.id);
                                channel.data.main_folders_ids = filteredFolders || [];
                                Main.instance?.store.update(channel.data.id, channel.data);

                                // Обновляем IndexedDB
                                await channelsTable().update(channel.data.id, {
                                    main_folders_ids: filteredFolders
                                });

                                // Убираем канал из панели папки
                                removeChannelFromFolderPane(folder.id, channel.data);

                                // Обновляем бейджи непрочитанных на вкладках папок
                                if (Main.instance) updateFolderUnread(Main.instance);

                                // Toast
                                Toast.success(window._lc.forms.main.components.channels.context_menu.toasts.success_unmove_from_folder, {
                                    position: "bottom-center"
                                });

                            }

                        }

                    } catch (error) {
                        Logger.error(error);

                        // Прочая ошибка сервера
                        Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");

                    }

                }
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Добавляем канал в панель указанной папки.
 * Строка создаётся тем же компонентом, что и при обычной загрузке списка,
 * поэтому сразу появляется в папке без перезагрузки.
 * @param folderId - Id папки.
 * @param data - Данные канала.
 * ***************************************************************************
 */
function addChannelToFolderPane(folderId: string, data: ChannelRecord): void {

    // Главная форма и её стор — источник строки; без них вставлять нечего
    const main = Main.instance;
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
function removeChannelFromFolderPane(folderId: string, data: ChannelRecord): void {

    // Панель папки и её список
    const pane = Main.instance?.foldersTabs?.getPane(folderId);
    const list = pane?.querySelector<HTMLElement>("[data-list]");

    // Строка канала в списке папки
    const row = list?.querySelector<HTMLElement>(`[data-id="${data.id}"]`);
    if (!row) return;

    // Удаляем строку из панели
    row.remove();

    // Чистим ссылку на DOM-копию, чтобы не копить утечки памяти
    const domElements = data.__domElements__;
    if (Array.isArray(domElements)) {
        const index = domElements.indexOf(row);
        if (index !== -1) {
            domElements.splice(index, 1);
        }
    }

}
