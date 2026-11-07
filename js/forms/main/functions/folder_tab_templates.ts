// Импортируем типы
import type { MainFolder } from "../types.js";

// ===========================================================================
// Константы шаблонов
// ===========================================================================

// Классы бейджа непрочитанных сообщений (общие для вкладок).
// Внимание: НЕ используем `inline-flex` вместе с `hidden` — в Tailwind v4
// .inline-flex идёт после .hidden и перебивает его (бейдж был бы виден всегда).
// Видимость управляется из JS переключением классов `flex`/`hidden`.
export const UNREAD_BADGE_CLASSES = "hidden min-w-[1.125rem] h-[1.125rem] px-1 items-center justify-center rounded-full text-[0.625rem] font-bold leading-none bg-[var(--color-red)] text-white";

/**
 * ***************************************************************************
 * Шаблон вкладки папки (горизонтальная лента папок на главной форме).
 *
 * Визуал вкладки: без скругления, выделение — верхняя линия 3px
 * (активная — цвет бренда, наведение — серый); фон не заливается.
 * Все классы состояния (hover/active) прописаны здесь, а не в
 * css/components/tabs.css — там только нейтральная база.
 *
 * Разметка собирается через DOMParser (без innerHTML), поэтому имя папки
 * не может сломать структуру документа.
 * @param folder - Данные папки.
 * @returns Элемент вкладки (выбрасывает ошибку, если разметка не распарсилась).
 * ***************************************************************************
 */
export function templateHorizontalTab(folder: MainFolder): HTMLElement {

    const element = new DOMParser().parseFromString(`
            <div data-target="${folder.id}" class="item relative flex flex-row flex-shrink-0 gap-1.5 px-3.5 py-2 items-center text-sm font-semibold transition-colors duration-150 cursor-pointer border-b-[3px] border-transparent hover:border-[var(--text-muted)] hover:text-[var(--text-color)] [&.active]:border-[var(--color-brand)] [&.active]:text-[var(--text-color)] [&.active:hover]:border-[var(--color-brand)]">
                <span data-name class="truncate">${folder.name}</span>
                <span data-unread class="${UNREAD_BADGE_CLASSES}"></span>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента вкладка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}

/**
 * ***************************************************************************
 * Шаблон контента (панели) вкладки папки.
 * @param pane - Данные вкладки (id).
 * @returns Элемент контента (выбрасывает ошибку, если разметка не распарсилась).
 * ***************************************************************************
 */
export function templatePane(pane: MainFolder): HTMLElement {

    const element = new DOMParser().parseFromString(`
            <div data-target="${pane.id}" class="item flex-col gap-0 p-2 w-full h-full relative">
                <div data-list class="flex flex-col gap-0 w-full h-full"></div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента панель не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}
