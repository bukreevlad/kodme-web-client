// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";

// Импортируем handlers (контекстное меню ссылки)
import { openAvailableActions } from "./handlers/available_actions.js";

// Импортируем handlers формы
import { openAvailableLinkHandler } from "../handlers/open_available_link.js";

// Импортируем типы
import { isCloudAvailableLink } from "../types.js";
import type { CloudAvailableLink } from "../types.js";
import type { Cloud } from "../index.js";

/**
 * Контракт компонента доступной ссылки для его контекстного меню.
 */
export interface CloudAvailableItemHandle {

    /** Экземпляр формы облака. */
    form: Cloud;

    /** Данные доступной ссылки. */
    data: CloudAvailableLink;

}

/**
 * ***************************************************************************
 * Строка списка «Доступное для меня».
 *
 * Фабрика возвращает готовый DOM-элемент (легаси-конструктор возвращал
 * элемент вместо this — в TS такой паттерн не типизируется честно):
 * `createCloudAvailableItem(form, data)`.
 *
 * @param form - Экземпляр формы облака.
 * @param data - Данные доступной ссылки.
 * @returns Готовый DOM-элемент строки.
 * ***************************************************************************
 */
export function createCloudAvailableItem(form: Cloud, data: CloudAvailableLink): HTMLElement {

    // Записываем данные: setup обновляет ссылку, как раньше это делал this.data
    let current = data;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Записываем ссылку на dom элемент
    if (!current.__domElements__) {
        current.__domElements__ = [];
    }
    current.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(current);

    // Прикрепляем обработчики событий
    actions();

    // Подписываем на обновление
    subscribeToUpdates();

    // Возвращаем сам элемент для вставки в DOM
    return element;

    /**
     * ***************************************************************************
     * Шаблон элемента: плитка либо строка списка (по типу просмотра формы).
     * @returns DOM-элемент строки.
     * ***************************************************************************
     */
    function template(): HTMLElement {

        // ---------- РЕЖИМ ПЛИТКИ ----------
        if (form.view === "grid") {
            // invariant: шаблон выше — наши строки, .item в нём всегда есть
            return new DOMParser().parseFromString(`
                <div class="item relative flex flex-col gap-1 p-2 items-center bg-[var(--second-bg)] hover:bg-[var(--color-black)]/5 active:bg-[var(--color-black)]/10 dark:hover:bg-[var(--color-white)]/10 dark:active:bg-[var(--color-white)]/15 cursor-pointer rounded-lg transition-all duration-200 motion-reduce:transition-none motion-safe:hover:scale-[1.02] motion-safe:hover:shadow-md motion-safe:active:scale-[.99]">
                    <div data-icon class="flex items-center justify-center shrink-0 w-12 h-12 bg-[var(--color-brand)]/10 text-[var(--color-brand)] rounded-lg">${Icons.icon("link", { settings: { size: 28 } })?.outerHTML}</div>
                    <div class="flex flex-col gap-0 w-full min-w-0 items-center">
                        <span data-name class="text-xs text-center truncate w-full"></span>
                        <span data-meta class="text-[0.625rem] text-muted truncate w-full text-center"></span>
                    </div>
                    <span data-access class="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-brand)]/10 text-[var(--color-brand)]"></span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-menu"], icon: "dots", classes: ["absolute", "top-1", "right-1"] })}
                </div>
            `, "text/html").querySelector<HTMLElement>(".item")!;
        }

        // ---------- РЕЖИМ СПИСКА ----------
        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 p-2 py-1 items-center bg-[var(--second-bg)] hover:bg-[var(--color-black)]/5 active:bg-[var(--color-black)]/10 dark:hover:bg-[var(--color-white)]/10 dark:active:bg-[var(--color-white)]/15 cursor-pointer rounded-lg">
                <div class="flex flex-row gap-2 items-center w-full min-w-0">
                    <div data-icon class="flex items-center justify-center shrink-0 w-8 h-8 bg-[var(--color-brand)]/10 text-[var(--color-brand)] rounded-lg">${Icons.icon("Link", { settings: { filled: true } })?.outerHTML}</div>
                    <div class="flex flex-col gap-0 min-w-0 flex-1">
                        <span data-name class="text-sm truncate"></span>
                        <span data-meta class="text-xs text-muted truncate"></span>
                    </div>
                    <span data-access class="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-brand)]/10 text-[var(--color-brand)]"></span>
                </div>
                ${Buttons.transparent({ shape: "circle", attributes: ["action-menu"], icon: "dots" })}
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Новые данные ссылки.
     * ***************************************************************************
     */
    function setup(next: CloudAvailableLink): void {

        try {

            // Сохраняем актуальные данные
            current = next;

            // Устанавливаем элементы
            const name = element.querySelector<HTMLElement>(":scope [data-name]");
            const meta = element.querySelector<HTMLElement>(":scope [data-meta]");
            const access = element.querySelector<HTMLElement>(":scope [data-access]");

            // Отображаем имя элемента
            if (name) {
                name.textContent = next.item_name || "";
            }

            // Отображаем автора и срок действия
            if (meta) {
                meta.textContent = _formatMeta(next);
            }

            // Отображаем уровень доступа
            if (access) {
                renderAccess(next, access);
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Отображение уровня доступа ссылки.
     * @param next - Данные ссылки.
     * @param node - Элемент уровня доступа.
     * ***************************************************************************
     */
    function renderAccess(next: CloudAvailableLink, node: HTMLElement): void {

        // Если доступ к записи
        if (next.access_level === "write") {
            node.textContent = window._lc.forms.cloud.badges.write;
        } else {
            node.textContent = window._lc.forms.cloud.badges.read;
        }

    }

    /**
     * ***************************************************************************
     * Обработчики: открытие ссылки и контекстное меню.
     * ***************************************************************************
     */
    function actions(): void {

        // Клик по элементу — открываем ссылку
        element.addEventListener("click", () => {
            openAvailableLinkHandler(form, current);
        });

        // Кнопка действий — контекстное меню
        let menu = element.querySelector<HTMLElement>("[action-menu]");
        menu?.addEventListener("click", (event) => {
            event.stopPropagation();
            openAvailableActions(event, handle());
        });

    }

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления ссылки.
     * ***************************************************************************
     */
    function subscribeToUpdates(): void {

        try {

            // Обновляем элемент при изменении данных
            form.availableStore.on(`item::updated::${current.id}`, (payload) => {
                update(payload);
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Обновление элемента: передаём новые данные в setup, чтобы перерисовать DOM.
     * @param payload - Полезная нагрузка события обновления.
     * ***************************************************************************
     */
    function update(payload: unknown): void {

        // Стор шлёт payload как unknown — сверяемся guard'ом
        if (!isCloudAvailableLink(payload)) return;

        // Передаем новые данные в setup, чтобы перерисовать DOM
        setup(payload);

    }

    /**
     * Вид компонента для контекстного меню (data всегда актуальный).
     * @returns Дескриптор компонента.
     */
    function handle(): CloudAvailableItemHandle {
        return { form, data: current };
    }

}

/**
 * ***************************************************************************
 * Формирование строки метаданных: автор и срок действия ссылки.
 * @param data - Данные ссылки.
 * @returns Строка метаданных.
 * ***************************************************************************
 */
function _formatMeta(data: CloudAvailableLink): string {

    // Части строки
    let parts: string[] = [];

    // Автор ссылки
    if (data.owner_first_name || data.owner_last_name) {
        parts.push(`${data.owner_first_name || ""} ${data.owner_last_name || ""}`.trim());
    }

    // Дата истечения срока
    if (data.expires_at) {
        let date = new Date(data.expires_at);
        parts.push(`${window._lc.forms.cloud.dates.until} ${date.toLocaleDateString()}`);
    }

    // Склеиваем части
    return parts.join(" · ");

}
