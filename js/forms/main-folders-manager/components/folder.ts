// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { t } from "../../../utils/i18n/index.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем dialogs
import { RemoveFolderDialog } from "../dialogs/remove-folder/index.js";

// Импортируем типы
import { isMainFoldersManagerFolder } from "../types.js";
import type { MainFoldersManager } from "../index.js";
import type { MainFoldersManagerFolder } from "../types.js";

/**
 * ***************************************************************************
 * Создание строки папки в списке менеджера папок.
 *
 * Строка подписывается на `item::updated::<id>` локального стора формы и
 * держит ссылку на себя в `data.__domElements__`, чтобы стор удалил все
 * копии разом.
 *
 * Легаси-компонент был классом-фабрикой (конструктор возвращал не `this`,
 * а DOM-элемент) — по канону миграции переписан в функцию-фабрику,
 * возвращающую готовый элемент. Мёртвые геттеры getDOM()/getData() удалены —
 * их никто не вызывал.
 * @param form - Форма-владелец строки.
 * @param data - Данные папки.
 * @returns Готовый DOM-элемент строки.
 * ***************************************************************************
 */
export function createFolderItem(form: MainFoldersManager, data: MainFoldersManagerFolder): HTMLElement {

    // Актуальные данные строки (обновляются при point-update из стора)
    let currentData = data;

    // Создаем DOM-элемент из шаблона
    const element = templateFolderItem();

    // Записываем ссылку на dom элемент
    if (!currentData.__domElements__) {
        currentData.__domElements__ = [];
    }
    currentData.__domElements__.push(element);

    // Устанавливаем начальные данные
    setupFolderItem(element, currentData);

    // Прикрепляем обработчики событий
    bindFolderItemActions(element, form, () => currentData, (next) => {

        // Обновляем актуальные данные и перерисовываем строку
        currentData = next;
        setupFolderItem(element, currentData);

    });

    // Подписываем на обновление: уникальное имя события — по id папки
    const unsubscribe = form.store.on(`item::updated::${currentData.id}`, (payload) => {

        // Пейлоад типизирован как unknown: строку перерисовываем только для записи папки
        if (!isMainFoldersManagerFolder(payload)) return;

        // Обновляем данные
        currentData = payload;
        setupFolderItem(element, currentData);

    });

    // Сохраняем функцию отписки в data, чтобы стор мог вызвать ее при удалении
    currentData.__unsubscribeStore__ = unsubscribe;

    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента.
 * Используем DOMParser для безопасного и чистого создания элемента.
 * @returns DOM-элемент строки.
 * ***************************************************************************
 */
function templateFolderItem(): HTMLElement {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-row gap-3 p-2.5 items-center rounded-lg transition-colors duration-150 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
            <div data-icon class="relative flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex-shrink-0">
                ${Icons.icon("Folder", { settings: { filled: true, size: 22 } })?.outerHTML}
                <span data-unread class="hidden absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 items-center justify-center rounded-full text-[0.625rem] font-bold leading-none bg-[var(--color-red)] text-white"></span>
            </div>
            <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                <span data-name class="font-semibold truncate"></span>
                <span data-count class="hidden text-xs text-muted"></span>
            </div>
            <div data-check-icon class="flex items-center shrink-0 text-[var(--color-brand)]">
                ${Icons.icon("check", { settings: { size: 20, stroke: 2.2 } })?.outerHTML}
            </div>
            ${Buttons.transparent({
                shape: "circle",
                attributes: ["action-folder-menu"],
                icon: { name: "dots-vertical", settings: { size: 20 } }
            })}
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}

/**
 * ***************************************************************************
 * Установка/Перерисовка данных строки.
 * @param element - DOM-элемент строки.
 * @param data - Данные папки.
 * ***************************************************************************
 */
function setupFolderItem(element: HTMLElement, data: MainFoldersManagerFolder): void {

    try {

        // Устанавливаем элементы
        const name = element.querySelector<HTMLElement>(":scope [data-name]");
        const count = element.querySelector<HTMLElement>(":scope [data-count]");
        const unread = element.querySelector<HTMLElement>(":scope [data-unread]");

        // Если папка выбрана
        if (data.is_selected) {
            element.classList.add("selected");
        } else {
            element.classList.remove("selected");
        }

        // Отображаем данные
        if (name) name.textContent = data.name;

        // Отображаем количество чатов в папке (если сервер вернул)
        if (typeof data.chats_count === "number" && count) {
            count.classList.remove("hidden");
            count.textContent = `${data.chats_count} ${t("forms.main_folders_manager.chats_count", { count: data.chats_count })}`;
        } else if (count) {
            count.classList.add("hidden");
        }

        // Отображаем бейдж непрочитанных сообщений в папке
        const unreadCount = Number(data.unread_count) || 0;
        if (unreadCount > 0 && unread) {
            unread.classList.remove("hidden");
            unread.classList.add("flex");
            unread.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        } else if (unread) {
            unread.classList.add("hidden");
            unread.classList.remove("flex");
        }

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Привязка обработчиков строки: клик (режим выбора) и контекстное меню.
 * @param element - DOM-элемент строки.
 * @param form - Форма-владелец строки.
 * @param getData - Геттер актуальных данных строки.
 * @param applyData - Применение обновлённых данных (обновляет closure и DOM).
 * ***************************************************************************
 */
function bindFolderItemActions(
    element: HTMLElement,
    form: MainFoldersManager,
    getData: () => MainFoldersManagerFolder,
    applyData: (data: MainFoldersManagerFolder) => void
): void {

    // Клик по элементу
    element.addEventListener("click", () => {

        const data = getData();

        // Если на форму передан callback (режим выбора папки)
        if (form.callback) {

            // Меняем состояние выбора
            applyData({ ...data, is_selected: !data.is_selected });
            form.callback(getData());

        }

    });

    // Меню папки
    const menu = element.querySelector<HTMLElement>("[action-folder-menu]");
    menu?.addEventListener("click", (event) => {
        event.stopPropagation();
        openFolderContextMenu(menu, getData());
    });

}

/**
 * ***************************************************************************
 * Открытие контекстного меню папки.
 * @param anchor - Элемент, от которого открывается меню.
 * @param data - Данные папки.
 * ***************************************************************************
 */
function openFolderContextMenu(anchor: HTMLElement, data: MainFoldersManagerFolder): void {

    // Элементы меню
    const menuItems = [
        {
            text: t("forms.main_folders_manager.components.folder.context_menu.remove"),
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => {

                // Подтверждаем удаление папки
                new RemoveFolderDialog({ folder: data });

            }
        }
    ];

    // Создаем и открываем контекстное меню
    const contextMenu = new Overlay(createPopoverMenu(menuItems), {
        type: "popover",
        targetNode: anchor,
        targetNodeDirection: ["bottom", "right"],
        margin: 4
    });
    contextMenu.open();

}
