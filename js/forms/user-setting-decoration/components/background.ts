// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";
import { SvgMaskManager } from "../../../core/managers/svg_mask_manager.js";

// Импортируем handlers
import { saveChatBackgroundPatternHandler } from "../handlers/save_chat_background_pattern.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";
import type { ChatBackgroundData } from "../types.js";

/**
 * ***************************************************************************
 * Фабрика элемента фона чатов: создаёт DOM-узел фона, отмечает активный фон
 * обводкой и вешает выбор фона по клику. Возвращает сам элемент для вставки
 * в DOM (конструктор-фабрика: элемент — и есть результат).
 * @param form - Экземпляр формы.
 * @param data - Данные фона.
 * @returns DOM-элемент фона.
 * ***************************************************************************
 */
export function createChatBackgroundItem(form: UserSettingDecorations, data: ChatBackgroundData): HTMLElement {

    // Создаем DOM-элемент из шаблона
    const element = new DOMParser().parseFromString(`
        <div class="item p-2 rounded-md cursor-pointer overflow-hidden aspect-9/16 relative"></div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    // Записываем ссылку на dom элемент (для удаления копий при item::removed)
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Устанавливаем начальные данные
    _setup(element, data);

    // Запомнить фон
    element.addEventListener("click", () => saveChatBackgroundPatternHandler(form, data));

    return element;

}

/**
 * ***************************************************************************
 * Установка/перерисовка данных элемента фона.
 * @param element - DOM-элемент фона.
 * @param data - Данные фона.
 * ***************************************************************************
 */
function _setup(element: HTMLElement, data: ChatBackgroundData): void {

    try {

        // Устанавливаем менеджер фонов для чата
        const manager = new SvgMaskManager(element, `/img/svg-backgrounds/${data.id}`);

        // Обводка
        element.classList.add("ring-2");
        element.classList.add("ring-[var(--border-color)]");

        // Инициализация менеджера фонов для чата
        manager.init();

        // Записываем id фона в атрибут для синхронизации активного состояния
        element.setAttribute("data-background-id", data.id);

        // Активное состояние: подсвечиваем обводкой фон, выбранный в текущем чате
        const currentSrc = LocalStorage.session?.settings?.user?.decorations?.chat_background?.src || "";
        const isActive = currentSrc === `img/svg-backgrounds/${data.id}`;
        element.classList.toggle("ring-[var(--color-brand)]", isActive);

    } catch (error) {
        Logger.error(error);
    }

}
