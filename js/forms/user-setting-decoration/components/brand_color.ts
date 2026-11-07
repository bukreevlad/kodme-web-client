// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем handlers
import { brandColorHandler } from "../handlers/brand_color.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";
import type { BrandColorData } from "../types.js";

/**
 * ***************************************************************************
 * Фабрика элемента выбора акцентного цвета (пресет или «цвет темы»): создаёт
 * DOM-узел кружка цвета, красит его и вешает выбор цвета по клику. Возвращает
 * сам элемент для вставки в DOM.
 * @param form - Экземпляр формы.
 * @param data - Данные цвета.
 * @returns DOM-элемент цвета.
 * ***************************************************************************
 */
export function createBrandColorItem(form: UserSettingDecorations, data: BrandColorData): HTMLElement {

    // Создаем DOM-элемент из шаблона
    const element = new DOMParser().parseFromString(`
        <div data-brand-color-item class="item relative aspect-square rounded-full cursor-pointer overflow-hidden border border-[var(--border-color)] transition-transform duration-150 hover:scale-110"></div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    // Устанавливаем начальные данные
    _setup(element, data);

    // Запомнить цвет
    element.addEventListener("click", () => brandColorHandler(form, data));

    return element;

}

/**
 * ***************************************************************************
 * Установка/перерисовка данных элемента цвета.
 * @param element - DOM-элемент цвета.
 * @param data - Данные цвета.
 * ***************************************************************************
 */
function _setup(element: HTMLElement, data: BrandColorData): void {

    try {

        // Записываем значение цвета в атрибут для синхронизации активного состояния
        element.setAttribute("data-brand-color", data.color || "");

        // Название для тултипа
        element.setAttribute("title", data.id);

        // Фон пресета: сам цвет, а для «цвета темы» (default) — текущий
        // --color-brand. Инлайновое значение (если пользователь ранее выбрал
        // пресет) временно снимаем, чтобы прочитать именно цвет темы;
        // читаем синхронно, без перерисовки — мигания не видно
        if (data.color) {
            element.style.background = data.color;
        } else {
            const root = document.documentElement;
            const inlineBrand = root.style.getPropertyValue("--color-brand");
            root.style.removeProperty("--color-brand");
            const themeBrand = getComputedStyle(root).getPropertyValue("--color-brand").trim();
            if (inlineBrand) root.style.setProperty("--color-brand", inlineBrand);
            element.style.background = themeBrand || "var(--color-brand)";
        }

        // Активное состояние: подсвечиваем кольцом выбранный цвет
        const currentColor = LocalStorage.session?.settings?.user?.decorations?.brand_color || "";
        const isActive = currentColor === (data.color || "");
        element.classList.toggle("ring-2", isActive);
        element.classList.toggle("ring-[var(--color-brand)]", isActive);
        element.classList.toggle("ring-offset-2", isActive);

    } catch (error) {
        Logger.error(error);
    }

}
