// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { AsyncQueue } from "../../../../../utils/helpers/async_queue.js";
import { ElectronNotifications } from "../../../../../utils/electron_notifications.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { Messages } from "../../../../messages/index.js";

// Импортируем functions
import { sortChatListVisually } from "../../../functions/sort_chat_list.js";
import { updateFolderUnread } from "../../../functions/update_folder_unread.js";
import { getSessionUserId } from "../../../functions/session_identity.js";
import { awaitPendingAcks } from "../../../../messages/functions/sending_messages.js";
import { MessageList } from "../../../../messages/functions/message_list.js";

// Импортируем db
import { channelsTable, cleanMessage, messagesTable } from "../../../db.js";

// Импортируем типы
import { isMessageRecord, parseUnread } from "../../../types.js";
import type { AddPageOptions } from "../../../types.js";

/**
 * ***************************************************************************
 * Подписка на новое сообщение: запись уходит в локальную БД, обновляются
 * счётчики канала (в БД и в сайдбаре), а открытый диалог дорисовывает
 * сообщение или подменяет локальное эхо серверным id.
 * @param asyncQueue - Общая очередью сообщений: события новых/обновлений/
 *   удалений выстраиваются в строгий порядок, чтобы не потерять гонки.
 * ***************************************************************************
 */
export function subscribeMessagesNew(asyncQueue: AsyncQueue): void {

    // ***************************************************************************
    // Новое сообщение
    // ***************************************************************************
    Socket.client.on("[message]: new", (data) => {
        Logger.debug("[app][ws]::[message]: new", data);

        // Сохраняем задачу в очереди и выполняем асинхронно
        asyncQueue.enqueue(async () => {

            try {

                // Нагрузка сокета типизирована как unknown: работаем только с записью сообщения
                if (!isMessageRecord(data)) return;

                // Подготавливаем данные для IndexedDB
                const cleanData = cleanMessage(data);

                // Если пользователь не подписан, то он не получает обновления от сервера
                await messagesTable().put(cleanData);

                // Получаем канал из IndexedDB
                const entityDB = await channelsTable().get(data.channel_id);

                // Если есть канал
                if (entityDB) {

                    // Обновляем данные канала
                    entityDB.last_message_id = data.id;
                    entityDB.last_message = cleanData;

                    // pts приходит строкой (bigint в pg сериализуется строкой),
                    // стор и типы хранят число
                    entityDB.last_pts = data.pts !== undefined ? Number(data.pts) : undefined;

                    // Увеличиваем счетчик, если чат сейчас не открыт
                    const currentForm = Messages.instances.get(data.channel_id);
                    if (!currentForm) {
                        entityDB.total_unread_messages = (parseUnread(entityDB.total_unread_messages) || 0) + 1;
                    }

                    // Записываем в IndexedDB
                    await channelsTable().put(entityDB);

                }

                // ======================================

                // Отображаем или обновляем сообщение
                const form = Messages.instances.get(data.channel_id);
                if (form) {

                    Logger.debug(`[app][ws]: Проверяем наличие serverId: ${data.id} в сторе формы.`);
                    let isMessage = form.store.get(data.id);

                    // Возможна гонка: эхо собственной отправки пришло раньше ответа сервера.
                    // Вместо угадывания тайминга (раньше был setTimeout(300)) детерминированно
                    // ждём именно ответов по нашим исходящим сообщениям: они резолвятся в
                    // sending_messages сразу после подмены localId -> serverId.
                    if (!isMessage && form.pendingIds?.size > 0 &&
                        data.created_user_id === getSessionUserId()) {

                        await awaitPendingAcks(form);
                        isMessage = form.store.get(data.id);

                    }

                    if (isMessage) {
                        Logger.debug(`[app][ws]: Сообщение с id: ${data.id} НАЙДЕНО в сторе. Вызываем обновление формы.`);
                        data.is_temporary = false;
                        data.is_pending = false;
                        form.store.update(data.id, data);

                        // Сообщение больше не ожидает ответа сервера
                        form.pendingIds?.delete(data.id);

                        // Вешаем обсервер когда флаги точно сброшены
                        if (isMessage.__domElements__) {
                            isMessage.__domElements__.forEach((element: HTMLElement | null, index: number) => {
                                if (element) {
                                    Logger.debug(`[app][ws]: Вешаем observer на копию №${index}. data-id элемента в DOM: "${data.id}"`);
                                    // Обсервер создаётся вместе с формой — без него
                                    // просто не наблюдаем элемент
                                    form.observer?.observe(element);
                                }
                            });
                        }

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
                const main = Main.instance;
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
                    // пропускаем (мут канала — здесь, остальное — в настройках)
                    if (!form && channelStore.is_notifications !== false
                        && data.created_user_id !== getSessionUserId()) {
                        ElectronNotifications.show({
                            title: channelStore.display_name || data.display_name || "",
                            body: data.text || "",
                            tag: `messages-${data.channel_id}`,
                            url: `/?channelId=${data.channel_id}`
                        }, "messages");
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

        });
    });
}
