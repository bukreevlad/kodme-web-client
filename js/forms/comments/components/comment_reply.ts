// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { attachmentStrip } from "./functions/attachment_strip.js";

// Импортируем типы
import type { Comments } from "../index.js";
import type { CommentRecord } from "../types.js";

/**
 * ***************************************************************************
 * createCommentReply - блок «Ответ на комментарий» внутри тела комментария.
 *
 * Возвращает готовый элемент для вставки в DOM (фабрика вместо класса:
 * экземпляр нигде не хранится, публичных методов у блока нет).
 * @param form - Экземпляр формы.
 * @param data - Данные комментария-ответа (reply_to_comment).
 * @returns DOM-элемент блока ответа.
 * ***************************************************************************
 */
export function createCommentReply(form: Comments, data: CommentRecord): HTMLElement {

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Устанавливаем начальные данные
    setup(element, data);

    // Прикрепляем обработчики событий
    actions(element, form, data);

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента.
 * Используем DOMParser для безопасного и чистого создания элемента.
 * @returns DOM-элемент блока ответа.
 * ***************************************************************************
 */
function template(): HTMLElement {

    // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
    const element = new DOMParser().parseFromString(`
        <div class="reply-wrap flex flex-col gap-0 p-1 items-start w-full rounded-md cursor-pointer bg-[var(--color-brand)]/10 border-l-3 border-[var(--color-brand)]">
            <span data-display-name class="font-semibold text-sm text-[var(--color-brand)] dark:text-[var(--color-brand)]"></span>
            <div class="flex flex-col gap-0 w-full overflow-hidden">
                <div data-media class="flex flex-row gap-1 empty:hidden overflow-hidden"></div>
                <span data-text class="truncate text-sm"></span>
            </div>
        </div>
    `, "text/html").querySelector<HTMLDivElement>(".reply-wrap");

    // Своя разметка всегда содержит «.reply-wrap» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .reply-wrap");

    return element;

}

/**
 * ***************************************************************************
 * Установка/Перерисовка данных блока.
 * @param element - DOM-элемент блока.
 * @param data - Данные комментария-ответа.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: CommentRecord): void {

    try {

        // Устанавливаем элементы
        const displayName = element.querySelector(":scope >[data-display-name]");
        const text = element.querySelector(":scope [data-text]");
        const media = element.querySelector(":scope [data-media]");

        // Сборка превью вложений и подписи — общая функция из Messages
        // (сигнатура расширена структурным типом, формы не объединяются)
        attachmentStrip(data, { displayName, text, media });

    } catch (error) {
        Logger.error("[app][comments][reply]:", error);
    }

}

/**
 * ***************************************************************************
 * Обработчики блока.
 * @param form - Экземпляр формы.
 * @param data - Данные комментария-ответа.
 * ***************************************************************************
 */
function actions(element: HTMLElement, form: Comments, data: CommentRecord): void {

    // Перейти к комментарию-предку (если он ещё в окне ленты)
    element.addEventListener("click", (event) => {

        // Не даём клику дойти до строки (свайп/контекстное меню)
        event.stopPropagation();

        // Ищем строку предка в DOM по id (вне окна — не подсвечиваем)
        const target = form.list?.querySelector<HTMLElement>(`:scope >[data-id="${data.id}"]`);
        if (!target) return;

        // Прокручиваем ленту к строке предка
        target.scrollIntoView({ behavior: "smooth", block: "center" });

        // Подсветка предка (пара highlightElements из Messages): снимаем класс,
        // сбрасываем reflow и навешиваем заново — иначе анимация при повторном
        // клике не перезапустится. Класс гасится сам через keyframes
        target.classList.remove("backlight");
        void target.offsetWidth;
        target.classList.add("backlight");

    });

}
