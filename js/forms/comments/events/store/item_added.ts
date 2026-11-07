// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createCommentItem, updateCommentItem } from "../../components/comment_item.js";
import { attachRowActions, disposeRowActions } from "../../components/comment_row_actions.js";

// Импортируем functions
import { CommentList } from "../../functions/comment_list.js";

// Импортируем типы
import { isCommentRecord, hasDirection } from "../../types.js";
import type { StoreIdChange } from "../../../../utils/store.js";
import type { Comments } from "../../index.js";
import type { CommentRecord } from "../../types.js";

/**
 * Диспонзеры персональных подписок строки (item::updated / item::id-changed).
 * Снимаются в item_removed либо при уничтожении элемента — иначе подписки
 * жили бы вечно и держали форму в памяти.
 */
const itemDisposers = new WeakMap<HTMLElement, () => void>();

/**
 * Снять персональные подписки и жесты строки (вызывается из item_removed).
 * @param item - DOM-узел строки.
 * @returns void
 */
export function disposeItemSubscriptions(item: Element): void {
    itemDisposers.get(item as HTMLElement)?.();
    itemDisposers.delete(item as HTMLElement);

    // Контроллер жестов строки (свайп/тап/ПКМ) уничтожается вместе с ней —
    // иначе подписки GestureController жили бы до закрытия формы
    disposeRowActions(item);
}

/**
 * ***************************************************************************
 * Подписка на событие добавления комментария в UI.
 *
 * Комментарии добавляются пачками (загрузка истории, live-события), поэтому
 * обрезка окна, пересборка разделителей, восстановление позиции скролла
 * и автопрокрутка выполняются ОДИН раз после окончания синхронной пачки
 * (microtask).
 *
 * @param form - Экземпляр формы.
 * @returns Функция отписки от события Store либо null.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: Comments): (() => void) | null {

    // Если форма не открыта
    if (!form) return null;

    try {

        // Инициализируем планировщик синхронизации окна (один раз на форму)
        if (!form._listSyncInit) {
            form._listSyncInit = true;
            form._listSyncScheduled = false;
            form._listSyncing = false;

            /**
             * Синхронизация окна ленты: обрезка, разделители, якорь скролла
             * и автопрокрутка к новому комментарию.
             */
            form._scheduleListSync = () => {

                // Уже запланировано или идёт синхронизация
                if (form._listSyncScheduled || form._listSyncing) return;
                form._listSyncScheduled = true;

                queueMicrotask(() => {
                    form._listSyncScheduled = false;
                    form._listSyncing = true;

                    try {

                        // Обрезаем окно до COMMENTS_WINDOW_SIZE
                        CommentList.trimWindow(form);

                        // Пересобираем разделители дат
                        CommentList.reconcileDividers(form);

                        // Обновляем разделитель «Новые комментарии»
                        CommentList.placeNewCommentsDivider(form);

                        // Восстанавливаем позицию скролла (только если список ещё на экране)
                        const scrollManager = form.listScrollManager;
                        if (scrollManager?.enabled && form.list?.isConnected) {
                            scrollManager.update();
                            scrollManager.restoreAnchor();
                        }

                        // Автопрокрутка к новому комментарию — строго ПОСЛЕ всех
                        // отрисовок пачки. Флаг ставит обработчик live-события ДО
                        // вставки, когда последний элемент был реально виден
                        // (CommentList.isLastItemVisible)
                        if (form._stickToBottom && scrollManager?.enabled && form.list?.isConnected) {
                            scrollManager.scrollToBottom("smooth");
                        }

                    } catch (error) {
                        Logger.error("[app][comments][item::added][sync]", error);
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
        // иначе после закрытия формы подписка жила вечно и держала её в памяти.
        const unsubscribe = form.store.on("item::added", (data, options) => {

            // Запоминаем якорь ДО изменения DOM (один раз на пачку)
            if (!form._listSyncScheduled) {
                form.listScrollManager?.saveAnchor();
            }

            // Запоминаем направление последней вставки (для обрезки противоположного края)
            form._lastInsertDirection = hasDirection(options) ? options.direction ?? null : null;

            // Без данных или контейнера списка рендерить нечего
            if (!isCommentRecord(data) || !form.list) return;

            // Рендерим строку комментария
            const item = createCommentItem(form, data as CommentRecord);
            if (!item) return;

            // Персональные подписки строки: перезаполнение при обновлении
            // записи (снятие is_sending/is_error_sending после ack) и
            // перепривязка data-id при replaceId (ack [comment]: send)
            _subscribeItemRow(form, item, data.id);

            // Жесты строки: свайп влево — ответ, тап/ПКМ — контекстное меню
            attachRowActions(form, item);

            // Включаем Observer для отслеживания видимости (реакции/прочтение)
            if (form.observer) {
                form.observer.observe(item);
            }

            // Вставляем в DOM: подгрузка вверх (prev) prepend'ится выше окна
            if (hasDirection(options) && options.direction === "prev") {
                form.list.prepend(item);
            } else {
                form.list.append(item);
            }

            // Откладываем обрезку окна и разделители до конца пачки
            form._scheduleListSync?.();

        });

        return unsubscribe;

    } catch (error) {
        Logger.error("[app][comments][item-added]", error);
        return null;
    }

}

/**
 * ***************************************************************************
 * Персональные подписки строки комментария.
 *
 * `item::updated::<id>` перезаполняет строку (снятие флагов отправки после
 * ack, свежая гидратация). `item::id-changed::<id>` перепривязывает data-id
 * после replaceId и переезжает на новое имя события — по образцу компонента
 * сообщений (message.ts::_subscribeToUpdates).
 * @param form - Экземпляр формы.
 * @param item - DOM-узел строки.
 * @param id - Текущий id комментария.
 * @returns void
 * ***************************************************************************
 */
function _subscribeItemRow(form: Comments, item: HTMLElement, id: string): void {

    // Текущий id строки: меняется при replaceId (ack [comment]: send)
    let currentId = id;

    // Функции отписки (снимаются при переподписке и в item_removed)
    let unsubUpdated: (() => void) | null = null;
    let unsubIdChanged: (() => void) | null = null;

    /**
     * (Пере)подписка на события Store текущего id строки.
     */
    const subscribe = () => {

        // Снимаем старые подписки (важно при смене id)
        unsubUpdated?.();
        unsubIdChanged?.();

        // Запись обновилась — перезаполняем строку (элемент могли уже удалить
        // из DOM триммером окна — проверяем isConnected)
        unsubUpdated = form.store.on(`item::updated::${currentId}`, (payload) => {
            if (!payload || !item.isConnected) return;

            // invariant: событие item::updated отдаёт запись этого комментария
            updateCommentItem(form, item, payload as CommentRecord);
        });

        // Id сменился — обновляем data-id и переезжаем на новое имя события
        unsubIdChanged = form.store.on(`item::id-changed::${currentId}`, (payload) => {

            // invariant: событие item::id-changed отдаёт StoreIdChange
            const change = payload as StoreIdChange;

            currentId = String(change.newId);
            item.dataset.id = currentId;

            // Переподписка: от старого id отпишется, на новый подпишется
            subscribe();
        });

    };

    subscribe();

    // Диспонзер снимает обе подписки (вызывается в item_removed)
    itemDisposers.set(item, () => {
        unsubUpdated?.();
        unsubIdChanged?.();
    });

}
