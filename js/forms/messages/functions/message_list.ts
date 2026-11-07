// Импортируем utils
import { TimeAgoFormatter } from "../../../utils/date/time_ago_formatter.js";
import { areDatesDifferent } from "../../../utils/date/different_dates.js";

// Импортируем config
import { MESSAGES_WINDOW_SIZE } from "../../../config/constants.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * MessageList - единая модель управления строками окна чата.
 * Строка окна - это сообщение, разделитель дат или маркер непрочитанных.
 * Модуль отвечает за:
 * - пересборку разделителей дат по соседним сообщениям (без "сирот");
 * - размещение маркера непрочитанных и контроль его жизненного цикла;
 * - обрезку окна до MESSAGES_WINDOW_SIZE с противоположного края.
 * ***************************************************************************
 */
export class MessageList {

    /**
     * ***************************************************************************
     * Шаблон разделителя дат (единый источник правды).
     * @param createdAt - Дата сообщения (ISO), для которого рисуем разделитель.
     * @returns DOM элемент разделителя.
     * ***************************************************************************
     */
    static templateDateSeparator(createdAt: string): HTMLElement | null {

        // Устанавливаем дату
        const timeAgo = new TimeAgoFormatter(createdAt, "date");

        // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
        return new DOMParser().parseFromString(`
            <div data-date-separator class="flex w-full my-2 justify-center pointer-events-none">
                <span data-text class="flex p-1 bg-white/50 dark:bg-white/10 justify-center text-sm rounded-md shadow-sm">${timeAgo.formattedTime}</span>
            </div>
            `, "text/html").querySelector<HTMLElement>("[data-date-separator]");
    }

    /**
     * ***************************************************************************
     * Шаблон маркера непрочитанных (единый источник правды).
     * @returns DOM элемент маркера.
     * ***************************************************************************
     */
    static templateUnreadMarker(): HTMLElement | null {

        // Текст маркера берём из локали (fallback - захардкоженное значение)
        const text = window._lc?.forms?.messages?.unread_messages || "Непрочитанные сообщения";

        // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
        return new DOMParser().parseFromString(`
            <div data-unread-messages class="flex w-full my-2 justify-center pointer-events-none">
                <span data-text class="flex p-1 bg-white/50 dark:bg-white/10 justify-center font-semibold text-sm rounded-md shadow-sm">${text}</span>
            </div>
            `, "text/html").querySelector<HTMLElement>("[data-unread-messages]");
    }

    /**
     * ***************************************************************************
     * Пересборка разделителей дат: удаляем все существующие и вставляем заново
     * между соседними сообщениями с разными датами. Вызов после ЛЮБОГО
     * структурного изменения списка исключает появление "сирот" и пропусков.
     * @param form - Экземпляр формы сообщений.
     * @returns void
     * ***************************************************************************
     */
    static reconcileDivider(form: Messages): void {

        // Если списка нет
        if (!form?.list) return;

        const list = form.list;

        // Собираем сообщения в порядке DOM (разделители и маркеры пропускаем)
        const items = Array.from(list.querySelectorAll(".item[data-id]"));

        // Удаляем все существующие разделители дат, чтобы пересобрать их заново
        list.querySelectorAll("[data-date-separator]").forEach(element => element.remove());

        // Проходим по соседним парам сообщений и ставим разделитель, если даты разные
        for (let i = 1; i < items.length; i++) {
            const prev = items[i - 1];
            const curr = items[i];
            if (!prev || !curr) continue;

            const prevId = prev.getAttribute("data-id");
            const currId = curr.getAttribute("data-id");

            // Без data-id пару идентифицировать не по чему
            if (prevId == null || currId == null) continue;

            const prevMessage = form.store?.get(prevId);
            const currMessage = form.store?.get(currId);

            // Если метаданные сообщений есть, даты определены и различаются —
            // рисуем разделитель
            const prevCreatedAt = prevMessage?.created_at;
            const currCreatedAt = currMessage?.created_at;
            if (prevCreatedAt != null && currCreatedAt != null && areDatesDifferent(currCreatedAt, prevCreatedAt)) {
                const divider = MessageList.templateDateSeparator(currCreatedAt);
                const parent = curr.parentNode;

                // Родитель может исчезнуть из DOM между поиском и вставкой
                if (parent && divider) parent.insertBefore(divider, curr);
            }
        }
    }

    /**
     * ***************************************************************************
     * Размещение маркера непрочитанных: маркер ставится перед сообщением,
     * id которого хранится в form.unreadMarkerBeforeId. Если сообщение выпало
     * из окна — ищем первое непрочитанное сообщение в текущем окне.
     * Маркер удаляется, как только пользователь проскроллил его за экран.
     * @param form - Экземпляр формы сообщений.
     * @returns void
     * ***************************************************************************
     */
    static placeUnreadMarker(form: Messages): void {

        // Если списка нет
        if (!form?.list) return;

        const list = form.list;

        // Сбрасываем старый observer, чтобы не плодить утечки
        form.unreadMarkerObserver?.disconnect();
        form.unreadMarkerObserver = null;

        // Удаляем все существующие маркеры
        list.querySelectorAll("[data-unread-messages]").forEach(element => element.remove());

        // Если маркер не нужен (прочитано или пользователь его проскроллил)
        const beforeId = form.unreadMarkerBeforeId;
        if (!beforeId) return;

        // Ищем сообщение, перед которым стоит маркер
        let target = list.querySelector<HTMLElement>(`.item[data-id="${beforeId}"]`);

        // Если сообщение выпало из окна — ищем первое непрочитанное в окне
        if (!target) {

            const lastViewedId = form.channel?.last_viewed_message_id;
            const items = Array.from(list.querySelectorAll<HTMLElement>(".item[data-id]"));

            for (const element of items) {
                const id = element.getAttribute("data-id");
                if (id && (!lastViewedId || id > lastViewedId)) {
                    target = element;
                    // Перепривязываем маркер к найденному сообщению
                    form.unreadMarkerBeforeId = id;
                    break;
                }
            }

            // Непрочитанных в окне нет — маркер не рисуем
            if (!target) {
                form.unreadMarkerBeforeId = null;
                return;
            }

        }

        // ==========================================================
        // Сверка со Store: элемент может остаться в DOM, но уже не
        // принадлежать окну (рассинхрон после trimWindow). В этом случае
        // маркер встал бы перед «мёртвым» сообщением и уехал бы вместе с ним.
        // ==========================================================
        const targetId = form.unreadMarkerBeforeId || beforeId;
        if (form.store?.get && !form.store.get(targetId)) {

            // Сообщения нет в Store вообще — маркер показывать не перед чем
            form.unreadMarkerBeforeId = null;
            return;

        }

        // Вставляем маркер перед сообщением. parentNode может быть null,
        // если между поиском и вставкой элемент успели удалить из DOM
        if (!target.parentNode) {

            form.unreadMarkerBeforeId = null;
            return;

        }

        const marker = MessageList.templateUnreadMarker();

        // Без узла маркера ставить нечего — сбрасываем пометку как выше
        if (!marker) {
            form.unreadMarkerBeforeId = null;
            return;
        }

        target.parentNode.insertBefore(marker, target);

        // Отслеживаем уход маркера за верхнюю границу экрана
        form.unreadMarkerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // Маркер полностью ушёл вверх — он больше не нужен
                if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
                    form.unreadMarkerBeforeId = null;
                    form.unreadMarkerObserver?.disconnect();
                    form.unreadMarkerObserver = null;
                    entry.target.remove();
                }
            });
        }, { threshold: 0 });

        form.unreadMarkerObserver.observe(marker);
    }

    /**
     * ***************************************************************************
     * Был ли последний элемент списка реально виден во вьюпорте.
     *
     * Считается ДО вставки нового сообщения: если читатель сидел внизу и
     * последний элемент списка пересекался с видимой областью — новое
     * сообщение должно подтянуть список к себе; если он читал историю наверху
     * — позицию чтения не дёргаем. Вызывается обработчиками live-сообщений
     * перед store.add (см. [message]: new), ФОНОВЫЕ подгрузки истории этим
     * признаком не пользуются.
     * @param form - Экземпляр формы сообщений.
     * @returns true, если последний элемент был хотя бы частично виден.
     * ***************************************************************************
     */
    static isLastItemVisible(form: Messages): boolean {

        const viewport = form.listScrollManager?.viewport;
        const lastItem = form.list?.lastElementChild;

        // Менеджера скролла ещё нет или список пуст — грепаться не к чему
        if (!viewport || !lastItem) return false;

        const itemRect = lastItem.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();

        // Пересечение по вертикали: элемент хотя бы частично в видимой области
        return itemRect.bottom > viewportRect.top && itemRect.top < viewportRect.bottom;

    }

    /**
     * ***************************************************************************
     * Обрезка окна до MESSAGES_WINDOW_SIZE: удаляем сообщения с края,
     * противоположного направлению вставки (prepend срезает максимум, append — минимум).
     * Разделители-сироты убирает последующая пересборка (reconcileDivider).
     * @param form - Экземпляр формы сообщений.
     * @returns void
     * ***************************************************************************
     */
    static trimWindow(form: Messages): void {

        // Если Store нет
        if (!form?.store) return;

        // Обрезаем, пока в Store больше MESSAGES_WINDOW_SIZE сообщений
        while (form.store.size > MESSAGES_WINDOW_SIZE) {

            // Край окна, противоположный направлению движения
            const edgeId = form._lastInsertDirection === "prev" ? form.store.maxId : form.store.minId;
            if (edgeId == null) break;

            // Удаление из Store автоматически убирает DOM-элементы (item::removed)
            form.store.remove(edgeId);
        }
    }
}
