// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { I18n } from "../../../utils/i18n/index.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";

// Импортируем типы
import type { SearchRecord } from "../types.js";
import type { Search } from "../index.js";

/**
 * ***************************************************************************
 * Строка результата поиска по каналам.
 *
 * Компонент самостоятельный (как строки в других формах): шаблон, селекторы,
 * подпись и клик живут здесь, общей базы нет. Отличие от сообществ — свой
 * раздел локализации подписи и круглый аватар; клик открывает чат канала,
 * поднимая уже открытый.
 *
 * `data-id` обязателен для скролла: по нему ScrollManager находит якорь
 * при вставке prev-пачки в начало списка (см. functions/load_section.ts).
 *
 * Фабрика возвращает готовый DOM-элемент (легаси-конструктор возвращал
 * элемент вместо this — в TS такой паттерн не типизируется честно):
 * `createChannelItem(form, data)`.
 *
 * @param form - Экземпляр формы поиска.
 * @param data - Данные записи.
 * @returns Готовый DOM-элемент строки.
 ***************************************************************************
 */
export function createChannelItem(form: Search, data: SearchRecord): HTMLElement {

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Проставляем id элементу: по нему ScrollManager ищет якорь скролла
    // при вставке пачки в начало списка (см. functions/load_section.ts)
    if (data.id) element.setAttribute("data-id", data.id);

    // Регистрируем копию элемента в записи: по ней `item::removed` ищет
    // все отображённые копии (одна запись может попасть в список дважды —
    // например, при гонке двух одинаковых страниц)
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(data);

    // Прикрепляем обработчики событий
    actions();

    // Возвращаем сам элемент для вставки в DOM
    return element;

    /**
     * ***************************************************************************
     * Шаблон элемента. Используем DOMParser для безопасного и чистого создания
     * элемента.
     * @returns DOM-элемент строки.
     * ***************************************************************************
     */
    function template(): HTMLElement {

        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-3 p-2 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg cursor-pointer">
                <div class="cdm-avatar relative"></div>
                <div class="flex flex-col gap-1 self-center">
                    <span data-name class="font-semibold truncate"></span>
                    <span data-members class="text-secondary"></span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Данные записи.
     * ***************************************************************************
     */
    function setup(next: SearchRecord): void {

        try {

            // Устанавливаем элементы
            const avatar = element.querySelector<HTMLElement>(":scope >.cdm-avatar");
            const name = element.querySelector<HTMLElement>(":scope [data-name]");
            const subtitle = element.querySelector<HTMLElement>(":scope [data-members]");

            // Аватар
            new Avatars({
                element: avatar,
                id: next.id,
                name: next.display_name,
                image: next.avatar,
                size: "xl"
            });

            // Название
            if (name) name.textContent = next.display_name ?? "";

            // Подпись: количество участников со склонением. Раздел локализации
            // свой у каналов и свой у сообществ: правка текста для одной
            // категории не должна менять другую
            if (subtitle) {
                const members = next.total_members ?? 0;
                I18n.setCount(subtitle, "forms.search._components.channels.subscribers", members);
            }

        } catch (error) {

            // Рендер строки — не пользовательское действие: тост здесь был бы
            // шумом на каждом догруженном элементе списка
            Logger.error("[app][search][createChannelItem]:", error);

        }

    }

    /**
     * ***************************************************************************
     * Обработчики: открытие чата канала по клику.
     * ***************************************************************************
     */
    function actions(): void {

        // Открыть канал, поднимая уже открытый: повторный клик не должен
        // плодить вторую форму
        element.addEventListener("click", () => {
            const instance = Messages.instances.get(data.id);
            if (instance) {
                instance?.modal?.activate();
            } else {
                new Messages({ channelId: data.id });
            }
        });

    }

}
