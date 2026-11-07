// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createSecretChatMessageItem } from "../../components/message.js";

// Импортируем functions
import { MessageList } from "../../functions/message_list.js";

// Импортируем типы
import { hasDirection, isDomElement, isSecretChatMessageRecord } from "../../types.js";
import type { SecretChat } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления сообщения в UI.
 *
 * Сообщения добавляются пачками (подгрузка истории, live-события), поэтому
 * обрезка окна, пересборка разделителей, восстановление позиции скролла
 * и автопрокрутка к новому сообщению выполняются ОДИН раз после окончания
 * синхронной пачки (microtask).
 *
 * @param form - Экземпляр формы.
 * @returns Функция отписки от события Store либо null.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: SecretChat): (() => void) | null {

    // Если форма не открыта
    if (!form) return null;

    try {

        // Инициализируем планировщик синхронизации окна (один раз на форму)
        if (!form._listSyncInit) {
            form._listSyncInit = true;
            form._listSyncScheduled = false;
            form._listSyncing = false;

            /**
             * Синхронизация окна чата: обрезка, разделители, маркер,
             * якорь скролла и автопрокрутка к новому сообщению.
             */
            form._scheduleListSync = () => {

                // Уже запланировано или идёт синхронизация
                if (form._listSyncScheduled || form._listSyncing) return;
                form._listSyncScheduled = true;

                queueMicrotask(() => {
                    form._listSyncScheduled = false;
                    form._listSyncing = true;

                    try {

                        // Обрезаем окно до MESSAGES_WINDOW_SIZE
                        MessageList.trimWindow(form);

                        // Пересобираем разделители дат
                        MessageList.reconcileDivider(form);

                        // Обновляем маркер непрочитанных
                        MessageList.placeUnreadMarker(form);

                        // Восстанавливаем позицию скролла (только если список ещё на экране)
                        const scrollManager = form.listScrollManager;
                        if (scrollManager?.enabled && form.list?.isConnected) {
                            scrollManager.update();
                            scrollManager.restoreAnchor();
                        }

                        // Автопрокрутка к новому сообщению — строго ПОСЛЕ всех
                        // отрисовок пачки (см. MessageList.isLastItemVisible):
                        // фоновые подгрузки истории список не дёргают
                        if (form._stickToBottom && scrollManager?.enabled && form.list?.isConnected) {
                            scrollManager.scrollToBottom("smooth");
                        }

                    } catch (error) {
                        Logger.error("[app][events][item::added][sync]:", error);
                    } finally {
                        form._listSyncing = false;

                        // Флаг живёт ровно одну пачку вставок
                        form._stickToBottom = false;
                    }
                });
            };
        }

        // Подписываемся на событие добавления элементов в Store.
        // Store.on() возвращает функцию отписки — её сохраняем на форме,
        // иначе после закрытия чата подписка жила вечно и держала форму в памяти.
        const unsubscribe = form.store.on("item::added", (data, options) => {

            // Запоминаем якорь ДО изменения DOM (один раз на пачку)
            if (!form._listSyncScheduled) {
                form.listScrollManager?.saveAnchor();
            }

            // Запоминаем направление последней вставки (для обрезки противоположного края)
            form._lastInsertDirection = hasDirection(options) ? options.direction ?? null : null;

            // Создаем инстанс сообщения (фабрика возвращает DOM-узел)
            if (!isSecretChatMessageRecord(data)) return;
            const item = createSecretChatMessageItem(form, data);
            if (!isDomElement(item)) return;

            // Включаем Observer для отслеживания прочтения
            if (form.observer) {
                form.observer.observe(item);
            }

            // Вставляем в DOM
            if (hasDirection(options) && options.direction === "prev") {
                form.list?.prepend(item);
            } else {
                form.list?.append(item);
            }

            // Откладываем обрезку окна и разделители до конца пачки
            form._scheduleListSync?.();

        });

        return unsubscribe;

    } catch (error) {
        Logger.error("[app][events][item::added]:", error);
        return null;
    }

}
