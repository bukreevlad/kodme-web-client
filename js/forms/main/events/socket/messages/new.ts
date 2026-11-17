// Импортируем utils
import { FormsRegistry } from "../../../../../core/managers/forms_registry.js";
import { Logger } from "../../../../../utils/logs/logger.js";
import { ElectronNotifications } from "../../../../../utils/electron_notifications.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { Messages } from "../../../../messages/index.js";

// Импортируем functions
import { sortChatListVisually } from "../../../functions/sort_chat_list.js";
import { updateFolderUnread } from "../../../functions/update_folder_unread.js";
import { getSessionUserId } from "../../../functions/session_identity.js";
import { MessageList } from "../../../../messages/functions/message_list.js";

// Импортируем db
import { channelsTable, cleanMessage, putFullMessages } from "../../../db.js";

// Импортируем типы
import { isMessageRecord, parseUnread } from "../../../types.js";
import type { AddPageOptions } from "../../../types.js";

/**
 * ***************************************************************************
 * Применяет событие нового сообщения к локальным хранилищам и UI: запись
 * уходит в локальную БД, обновляются счётчики канала (в БД и в сайдбаре),
 * а открытый диалог дорисовывает сообщение или подменяет локальное эхо
 * серверным id.
 * @param data - Нагрузка события (запись сообщения).
 * @param live - Признак живой доставки события: при false нативное
 *   уведомление десктоп-обёртки не показывается.
 * @returns {void}
 * ***************************************************************************
 */
export async function applyMessageNew(data: unknown, live = true): Promise<void> {
    Logger.debug("[app][feed]::message_new", data);

    try {

        // Нагрузка сокета типизирована как unknown: работаем только с записью сообщения
        if (!isMessageRecord(data)) return;

        // Подготавливаем данные для IndexedDB
        const cleanData = cleanMessage(data);

        // Если пользователь не подписан, то он не получает обновления от сервера
        await putFullMessages([cleanData]);

        // Получаем канал из IndexedDB
        const entityDB = await channelsTable().get(data.channel_id);

        // Если есть канал
        if (entityDB) {

            // Обновляем данные канала
            entityDB.last_message_id = data.id;
            entityDB.last_message = cleanData;

            // Увеличиваем счетчик, если чат сейчас не открыт
            const currentForm = FormsRegistry.getOwner<Messages>(`messages:${data.channel_id}`);
            if (!currentForm) {
                entityDB.total_unread_messages = (parseUnread(entityDB.total_unread_messages) || 0) + 1;
            }

            // Патч: удалённый параллельно канал не «воскресает»
            await channelsTable().update(entityDB.id, {
                last_message_id: entityDB.last_message_id,
                last_message: entityDB.last_message,
                total_unread_messages: entityDB.total_unread_messages
            });

        }

        // ======================================

        // Отображаем или обновляем сообщение
        const form = FormsRegistry.getOwner<Messages>(`messages:${data.channel_id}`);
        if (form) {

            Logger.debug(`[app][ws]: Проверяем наличие serverId: ${data.id} в сторе формы.`);

            // Эхо несёт random_id исходящего — находим локальную запись
            // по нему и переименовываем в серверный id
            const localId = typeof data.random_id === "string" && data.random_id ? data.random_id : null;
            const localEcho = localId != null ? form.store.get(localId) : undefined;
            if (localEcho && localEcho.id !== data.id) {
                form.store.replaceId(localEcho.id, data.id);
                Logger.debug(`[app][ws]: Найдено локальное эхо ${localId} по random_id, replaceId на ${data.id}.`);
            }

            const isMessage = form.store.get(data.id);

            if (isMessage) {
                Logger.debug(`[app][ws]: Сообщение с id: ${data.id} НАЙДЕНО в сторе. Вызываем обновление формы.`);
                data.is_temporary = false;
                data.is_pending = false;
                form.store.update(data.id, data);

                // Вешаем обсервер когда флаги точно сброшены (DOM-копии
                // берём из реестра стора формы)
                form.store.getDomElements(data.id).forEach((element, index) => {
                    Logger.debug(`[app][ws]: Вешаем observer на копию №${index}. data-id элемента в DOM: "${data.id}"`);
                    // Обсервер создаётся вместе с формой — без него
                    // просто не наблюдаем элемент
                    form.observer?.observe(element);
                });

            } else {
                Logger.warn(`[app][ws]: Сообщение с id: ${data.id} НЕ НАЙДЕНО в сторе. Добавляем как новое через store.add.`);
                const options: AddPageOptions = { direction: "next" };

                // Подтягиваем список к новому сообщению только если
                // последний элемент реально был виден ДО вставки (читатель
                // сидел внизу); сам скролл выполняется в подписке
                // item::added после синхронизации окна — иначе
                // restoreAnchor обрывает анимацию. Фоновые подгрузки
                // истории этим признаком не пользуются
                if (MessageList.isLastItemVisible(form)) form._stickToBottom = true;

                form.store.add(data, options);
            }

        }

        // ======================================

        // Main-инстанс создаётся при старте приложения; без него
        // обновить стор каналов и бейджи папок не получится
        const main = FormsRegistry.getOwner<Main>("main");
        if (!main) return;

        // Обновление канала в Main Store
        const channelStore = main.store.get(data.channel_id);

        // Если канал найден
        if (channelStore) {
            channelStore.last_message_id = data.id;
            channelStore.last_message = data;

            // Если форма не открыта
            if (!form) {
                channelStore.total_unread_messages = (parseUnread(channelStore.total_unread_messages) || 0) + 1;
            }
            main.store.update(channelStore.id, channelStore);

            // Обновляем бейджи непрочитанных на вкладках папок
            updateFolderUnread(main);

            // Нативное уведомление десктоп-обёртки: Electron без
            // push-сервиса — уведомляем сами при неактивном окне.
            // Свои сообщения и каналы с выключенными уведомлениями
            // пропускаем (мьют канала — здесь, остальное — в настройках)
            if (!form && channelStore.notifications?.mode === "all"
                && data.author_id !== getSessionUserId()) {
                if (live) {
                    ElectronNotifications.show({
                        title: channelStore.display_name || data.display_name || "",
                        body: data.text || "",
                        tag: `messages-${data.channel_id}`,
                        url: `/?channelId=${data.channel_id}`
                    }, "messages");
                }
            }

        }

        // ======================================
        // Визуальная сортировка каналов
        // ======================================

        // Получаем все списки в которых есть канал
        const foldersTabs = main.foldersTabs;
        const currentIdFolder = foldersTabs?.currentId;
        const currentPane = currentIdFolder != null ? foldersTabs?.getPane(currentIdFolder) : undefined;
        const currentList = currentPane?.querySelector<HTMLElement>("[data-list]") ?? null;

        // Вызываем визуальную сортировку каналов в папках
        sortChatListVisually(currentList, main.store);

        // ======================================

    } catch (error) {
        Logger.error(error);
    }
}
