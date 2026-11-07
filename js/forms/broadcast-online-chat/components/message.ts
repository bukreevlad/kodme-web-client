// Импортируем utils
import { hashString } from "../../../utils/string/string_to_hash.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { OnlineChatMessage } from "../types.js";

/**
 * Палитра цветов имён авторов: красный, оранжевый, жёлтый, зелёный, синий
 * в трёх вариантах яркости (светлый/базовый/тёмный).
 */
const NAME_COLORS = [
    "var(--color-red)",
    "color-mix(in srgb, var(--color-red) 55%, white)",
    "color-mix(in srgb, var(--color-red) 55%, black)",
    "var(--color-orange)",
    "color-mix(in srgb, var(--color-orange) 55%, white)",
    "color-mix(in srgb, var(--color-orange) 55%, black)",
    "var(--color-yellow)",
    "color-mix(in srgb, var(--color-yellow) 55%, white)",
    "color-mix(in srgb, var(--color-yellow) 55%, black)",
    "var(--color-green)",
    "color-mix(in srgb, var(--color-green) 55%, white)",
    "color-mix(in srgb, var(--color-green) 55%, black)",
    "var(--color-blue)",
    "color-mix(in srgb, var(--color-blue) 55%, white)",
    "color-mix(in srgb, var(--color-blue) 55%, black)",
];

/**
 * ***************************************************************************
 * createMessageItem - строка сообщения онлайн-чата.
 *
 * Отображает имя автора (цвет стабильно вычисляется из его id) и текст
 * сообщения. Строка живёт в data.__domElements__ для удаления копий при
 * выгрузке из стора.
 *
 * Фабрика возвращает готовый DOM-элемент (легаси-конструктор возвращал
 * элемент вместо this — в TS такой паттерн не типизируется честно):
 * `createMessageItem(data)`.
 *
 * @param data - Данные сообщения.
 * @returns Готовый DOM-элемент строки.
 * ***************************************************************************
 */
export function createMessageItem(data: OnlineChatMessage): HTMLElement {

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Записываем ссылку на dom элемент
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(data);

    // Возвращаем сам элемент для вставки в DOM
    return element;

    /**
     * ***************************************************************************
     * Шаблон элемента: DOMParser создаёт DOM без innerHTML.
     * @returns DOM-элемент строки сообщения.
     * ***************************************************************************
     */
    function template(): HTMLElement {

        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-col gap-0">
                <div class="wrap">
                    <span data-display-name class="font-semibold"></span>
                    <span data-text class="font-semibold text-white [text-shadow:0px_1px_1px_black]"></span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Новые данные сообщения.
     * ***************************************************************************
     */
    function setup(next: OnlineChatMessage): void {

        try {

            // Получаем числовой хеш из UUID
            let hash = hashString(next.created_user_id);

            // Вычисляем индекс цвета (остаток от деления)
            let colorIndex = hash % NAME_COLORS.length;

            // Выбираем цвет
            let textColor = NAME_COLORS[colorIndex] ?? "";

            // Устанавливаем элементы: invariant — все data-* селекторы ниже
            // есть в шаблоне template(), строка создана из него же
            let name = element.querySelector<HTMLElement>("[data-display-name]");
            let text = element.querySelector<HTMLElement>("[data-text]");

            // Отображаем данные
            if (name) name.textContent = next.display_name;
            if (name) name.style.color = textColor;
            if (text) text.textContent = next.text;

        } catch (error) {
            Logger.error(error);
        }

    }

}
