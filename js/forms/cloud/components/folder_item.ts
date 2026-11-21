// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { GestureController } from "../../../utils/gesture_controller.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";

// Импортируем handlers (контекстное меню папки)
import { openFolderActions } from "./handlers/folder_actions.js";

// Импортируем handlers формы
import { openFolderHandler } from "../handlers/open_folder.js";
import { openSharedFolderHandler } from "../handlers/open_shared_folder.js";

// Импортируем типы
import { isCloudItem } from "../types.js";
import { CloudItem, CloudItemMode } from "../types.js";
import type { Store } from "../../../utils/store.js";
import type { Cloud } from "../index.js";

/**
 * Контракт компонента папки для его контекстного меню.
 */
export interface CloudFolderItemHandle {

    /** Экземпляр формы облака. */
    form: Cloud;

    /** Данные папки. */
    data: CloudItem;

    /** Режим навигации элемента. */
    mode: CloudItemMode;

}

/**
 * ***************************************************************************
 * Строка списка папки (своё облако либо общий доступ).
 *
 * Фабрика возвращает готовый DOM-элемент: `createCloudFolderItem(form,
 * data, store, mode)`.
 *
 * @param form - Экземпляр формы облака.
 * @param data - Данные папки.
 * @param store - Хранилище элементов (по умолчанию — своё облако).
 * @param mode - Режим навигации ["mine" | "shared"].
 * @returns Готовый DOM-элемент строки.
 * ***************************************************************************
 */
export function createCloudFolderItem(
    form: Cloud,
    data: CloudItem,
    store?: Store<CloudItem>,
    mode: CloudItemMode = "mine"
): HTMLElement {

    // Записываем данные: setup обновляет ссылку, как раньше это делал this.data
    let current = data;
    const ownerStore = store || form.store;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Регистрируем DOM-копию строки в реестре стора
    ownerStore.registerDomElement(current.id, element);

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
                    <div data-icon class="flex items-center justify-center shrink-0 w-12 h-12 bg-[var(--color-yellow)]/10 text-[var(--color-yellow)] rounded-lg">${Icons.icon("folder", { settings: { size: 28 } })?.outerHTML}</div>
                    <span data-name class="flex items-center justify-center text-xs text-center truncate w-full"></span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-menu"], icon: { name: "dots", settings: { size: 14 } }, classes: ["absolute", "top-0.5", "right-0.5", "p-1!"] })}
                </div>
            `, "text/html").querySelector<HTMLElement>(".item")!;
        }

        // ---------- РЕЖИМ СПИСКА ----------
        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 p-2 py-1 items-center bg-[var(--second-bg)] hover:bg-[var(--color-black)]/5 active:bg-[var(--color-black)]/10 dark:hover:bg-[var(--color-white)]/10 dark:active:bg-[var(--color-white)]/15 cursor-pointer rounded-lg">
                <div class="flex flex-row gap-2 items-center w-full min-w-0">
                    <div data-icon class="flex items-center justify-center shrink-0 w-8 h-8 bg-[var(--color-yellow)]/10 text-[var(--color-yellow)] rounded-lg">${Icons.icon("folder", { settings: { size: 20 } })?.outerHTML}</div>
                    <div class="flex flex-col gap-0 min-w-0 flex-1">
                        <span data-name class="text-sm truncate"></span>
                        <span data-date class="text-xs text-muted truncate"></span>
                    </div>
                </div>
                ${Buttons.transparent({ shape: "circle", attributes: ["action-menu"], icon: "dots" })}
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Новые данные папки.
     * ***************************************************************************
     */
    function setup(next: CloudItem): void {

        try {

            // Сохраняем актуальные данные
            current = next;

            // Устанавливаем элементы
            const name = element.querySelector<HTMLElement>(":scope [data-name]");
            const date = element.querySelector<HTMLElement>(":scope [data-date]");

            // Отображаем данные
            if (name) {
                name.textContent = next.name ?? null;
            }

            // Дата создания папки — под её именем
            if (date) {
                date.textContent = next.created_at ? formatDate(next.created_at) : "";
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Форматировать дату создания по локали браузера.
     * @param createdAt - Дата создания (ISO).
     * @returns Отформатированная дата.
     * ***************************************************************************
     */
    function formatDate(createdAt: string): string {

        // Создаем дату и форматируем по локали браузера
        return new Date(createdAt).toLocaleDateString();

    }

    /**
     * ***************************************************************************
     * Обработчики: открытие папки по тапу, контекстное меню — по кнопке,
     * правому клику (десктоп) и долгому тапу (мобильные).
     * ***************************************************************************
     */
    function actions(): void {

        // Кнопка действий — контекстное меню
        // (в общем доступе — только при праве записи)
        let menu = element.querySelector<HTMLElement>("[action-menu]");
        let canWrite = ["owner", "write"].includes(
            form.sharedAccessLevel || form.sharedLink?.access_level || "read"
        );
        let canOpenActions = mode !== "shared" || canWrite;
        if (menu) {
            if (canOpenActions) {
                menu.classList.remove("hidden");
                menu.addEventListener("click", (event) => {
                    event.stopPropagation();
                    openFolderActions(event, handle());
                });
            } else {
                menu.classList.add("hidden");
            }
        }

        // Тапы и ПКМ по строке. Открытие папки лежит в tap.onTap, а не в click:
        // после долгого тапа браузер генерирует синтетический click, и папка
        // открылась бы поверх меню
        new GestureController(element, {
            threshold: 5,
            // Кнопка действий обрабатывается своим click-слушателем
            ignore: ["[action-menu]"],
            onContextMenu: (event) => {
                event.preventDefault();

                // На мобильных долгое удержание порождает и contextmenu, и
                // долгий тап — меню открывает только один из них
                if (IsMobile.get()) return;
                if (!canOpenActions) return;
                openFolderActions(event, handle());
            },
            tap: {
                // timeout = longTapTimeout: зажатие до 500 мс — тап (открытие),
                // дольше — долгий тап (меню на мобильных)
                timeout: 500,
                longTapTimeout: 500,
                onTap: () => {
                    if (mode === "shared") {
                        openSharedFolderHandler(form, current);
                    } else {
                        openFolderHandler(form, current);
                    }
                },
                onLongTap: (event) => {

                    // Долгий тап — мобильное меню; на ПК то же делает правый клик
                    if (!IsMobile.get()) return;
                    if (!canOpenActions) return;
                    if (event.cancelable) event.preventDefault();

                    openFolderActions(event, handle());

                }
            }
        });

    }

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления папки.
     * ***************************************************************************
     */
    function subscribeToUpdates(): void {

        try {

            // Обновляем элемент при изменении данных
            ownerStore.on(`item::updated::${current.id}`, (payload) => {
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
        if (!isCloudItem(payload)) return;

        // Передаем новые данные в setup, чтобы перерисовать DOM
        setup(payload);

    }

    /**
     * Вид компонента для контекстного меню (data всегда актуальный).
     * @returns Дескриптор компонента.
     */
    function handle(): CloudFolderItemHandle {
        return { form, data: current, mode };
    }

}
