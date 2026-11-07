// Импортируем utils
import { areDatesDifferent } from "../../../utils/date/different_dates.js";

// Импортируем config
import { COMMENTS_WINDOW_SIZE } from "../../../config/constants.js";

// Импортируем типы
import type { Comments } from "../index.js";
import { I18n, t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * CommentList - модель управления строками окна ленты комментариев.
 * Строка окна - это комментарий, разделитель дат или разделитель
 * «Новые комментарии». Модуль отвечает за:
 * - пересборку разделителей дат по соседним комментариям (без «сирот»);
 * - размещение разделителя «Новые комментарии» и его жизненный цикл;
 * - обрезку окна до COMMENTS_WINDOW_SIZE с противоположного края.
 * ***************************************************************************
 */
export class CommentList {

    /**
     * ***************************************************************************
     * Шаблон разделителя дат (единый источник правды).
     * @param createdAt - Дата комментария (ISO), для которого рисуем разделитель.
     * @returns DOM элемент разделителя.
     * ***************************************************************************
     */
    static templateDateSeparator(createdAt: string): HTMLElement | null {

        // Мы используем DOMParser для создания DOM без innerHTML
        const separator = new DOMParser().parseFromString(`
            <div data-date-separator class="flex w-full my-2 justify-center pointer-events-none">
                <span data-text class="flex p-1 bg-white/50 dark:bg-white/10 justify-center text-sm rounded-md shadow-sm"></span>
            </div>
            `, "text/html").querySelector<HTMLElement>("[data-date-separator]");

        // Дата-разделитель пересобирается при смене языка (Intl на новой локали)
        const timeEl = separator?.querySelector<HTMLElement>("[data-text]");
        if (timeEl) I18n.setTime(timeEl, createdAt, "date");

        return separator;
    }

    /**
     * ***************************************************************************
     * Шаблон разделителя «Новые комментарии» (единый источник правды).
     * @returns DOM элемент разделителя.
     * ***************************************************************************
     */
    static templateNewCommentsDivider(): HTMLElement | null {

        // Текст берём из локали (fallback — захардкоженное значение)
        const text = t("forms.comments.new_comments");

        // Мы используем DOMParser для создания DOM без innerHTML
        return new DOMParser().parseFromString(`
            <div data-new-comments class="flex w-full my-2 justify-center pointer-events-none">
                <span data-text class="flex p-1 bg-white/50 dark:bg-white/10 justify-center font-semibold text-sm rounded-md shadow-sm">${text}</span>
            </div>
            `, "text/html").querySelector<HTMLElement>("[data-new-comments]");
    }

    /**
     * ***************************************************************************
     * Пересборка разделителей дат: удаляем все существующие и вставляем заново
     * между соседними комментариями с разными датами. Вызов после ЛЮБОГО
     * структурного изменения списка исключает появление «сирот» и пропусков.
     * @param form - Экземпляр формы.
     * @returns void
     * ***************************************************************************
     */
    static reconcileDividers(form: Comments): void {

        // Если списка нет
        if (!form?.list) return;

        const list = form.list;

        // Собираем комментарии в порядке DOM (разделители пропускаем)
        const items = Array.from(list.querySelectorAll(".comment-item[data-id]"));

        // Удаляем все существующие разделители дат, чтобы пересобрать их заново
        list.querySelectorAll("[data-date-separator]").forEach(element => element.remove());

        // Проходим по соседним парам комментариев и ставим разделитель, если даты разные
        for (let i = 1; i < items.length; i++) {
            const prev = items[i - 1];
            const curr = items[i];
            if (!prev || !curr) continue;

            const prevId = prev.getAttribute("data-id");
            const currId = curr.getAttribute("data-id");

            // Без data-id пару идентифицировать не по чему
            if (prevId == null || currId == null) continue;

            const prevComment = form.store.get(prevId);
            const currComment = form.store.get(currId);

            // Если метаданные комментариев есть, даты определены и различаются —
            // рисуем разделитель
            const prevCreatedAt = prevComment?.created_at;
            const currCreatedAt = currComment?.created_at;
            if (prevCreatedAt != null && currCreatedAt != null && areDatesDifferent(currCreatedAt, prevCreatedAt)) {
                const divider = CommentList.templateDateSeparator(currCreatedAt);
                const parent = curr.parentNode;

                // Родитель может исчезнуть из DOM между поиском и вставкой
                if (parent && divider) parent.insertBefore(divider, curr);
            }
        }
    }

    /**
     * ***************************************************************************
     * Размещение разделителя «Новые комментарии»: разделитель ставится перед
     * комментарием, id которого хранится в form.newDividerBeforeId (первый
     * комментарий новее сохранённой позиции чтения). Если комментарий выпал
     * из окна — ищем первый новый комментарий в текущем окне. Разделитель
     * удаляется, как только пользователь проскроллил его за экран.
     * @param form - Экземпляр формы.
     * @returns void
     * ***************************************************************************
     */
    static placeNewCommentsDivider(form: Comments): void {

        // Если списка нет
        if (!form?.list) return;

        const list = form.list;

        // Сбрасываем старый observer, чтобы не плодить утечки
        form.newDividerObserver?.disconnect();
        form.newDividerObserver = null;

        // Удаляем все существующие разделители
        list.querySelectorAll("[data-new-comments]").forEach(element => element.remove());

        // Если разделитель не нужен (прочитано или пользователь его проскроллил)
        const beforeId = form.newDividerBeforeId;
        if (!beforeId) return;

        // Ищем комментарий, перед которым стоит разделитель
        let target = list.querySelector<HTMLElement>(`.comment-item[data-id="${beforeId}"]`);

        // Если комментарий выпал из окна — ищем первый новый в окне
        if (!target) {

            const lastViewedId = form.lastViewedCommentId;
            const items = Array.from(list.querySelectorAll<HTMLElement>(".comment-item[data-id]"));

            for (const element of items) {
                const id = element.getAttribute("data-id");
                if (id && (!lastViewedId || id > lastViewedId)) {
                    target = element;
                    // Перепривязываем разделитель к найденному комментарию
                    form.newDividerBeforeId = id;
                    break;
                }
            }

            // Новых в окне нет — разделитель не рисуем
            if (!target) {
                form.newDividerBeforeId = null;
                return;
            }

        }

        // ==========================================================
        // Сверка со Store: элемент может остаться в DOM, но уже не
        // принадлежать окну (рассинхрон после trimWindow). В этом случае
        // разделитель встал бы перед «мёртвым» комментарием и уехал бы с ним.
        // ==========================================================
        const targetId = form.newDividerBeforeId || beforeId;
        if (!form.store.get(targetId)) {

            // Комментария нет в Store вообще — разделитель показывать не перед чем
            form.newDividerBeforeId = null;
            return;

        }

        // Вставляем разделитель перед комментарием. parentNode может быть null,
        // если между поиском и вставкой элемент успели удалить из DOM
        if (!target.parentNode) {

            form.newDividerBeforeId = null;
            return;

        }

        const divider = CommentList.templateNewCommentsDivider();

        // Без узла разделителя ставить нечего — сбрасываем пометку как выше
        if (!divider) {

            form.newDividerBeforeId = null;
            return;

        }

        target.parentNode.insertBefore(divider, target);

        // Отслеживаем уход разделителя за верхнюю границу экрана
        form.newDividerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // Разделитель полностью ушёл вверх — он больше не нужен
                if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
                    form.newDividerBeforeId = null;
                    form.newDividerObserver?.disconnect();
                    form.newDividerObserver = null;
                    entry.target.remove();
                }
            });
        }, { threshold: 0 });

        form.newDividerObserver.observe(divider);
    }

    /**
     * ***************************************************************************
     * Был ли последний элемент списка реально виден во вьюпорте.
     *
     * Считается ДО вставки нового комментария: если читатель сидел внизу и
     * последний элемент списка пересекался с видимой областью — новое
     * сообщение должно подтянуть список к себе; если он читал историю наверху
     * — позицию чтения не дёргаем. Вызывается обработчиками live-комментариев
     * перед store.add.
     * @param form - Экземпляр формы.
     * @returns true, если последний элемент был хотя бы частично виден.
     * ***************************************************************************
     */
    static isLastItemVisible(form: Comments): boolean {

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
     * Обрезка окна до COMMENTS_WINDOW_SIZE: удаляем комментарии с края,
     * противоположного направлению вставки (prepend срезает максимум,
     * append — минимум). Разделители-сироты убирает последующая пересборка
     * (reconcileDividers).
     * @param form - Экземпляр формы.
     * @returns void
     * ***************************************************************************
     */
    static trimWindow(form: Comments): void {

        // Если Store нет
        if (!form?.store) return;

        // Обрезаем, пока в Store больше COMMENTS_WINDOW_SIZE комментариев
        while (form.store.size > COMMENTS_WINDOW_SIZE) {

            // Край окна, противоположный направлению движения
            const edgeId = form._lastInsertDirection === "prev" ? form.store.maxId : form.store.minId;
            if (edgeId == null) break;

            // Удаление из Store автоматически убирает DOM-элементы (item::removed)
            form.store.remove(edgeId);
        }
    }
}
