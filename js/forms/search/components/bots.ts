// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем forms
import { BotProfile } from "../../bot-profile/index.js";

// Импортируем типы
import type { SearchRecord } from "../types.js";
import type { Search } from "../index.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Строка результата поиска по ботам.
 *
 * Компонент самостоятельный (как строки в других формах): шаблон, селекторы,
 * подпись и клик живут здесь, общей базы нет. Отличия от пользователя: имя
 * бота — публичная ссылка (`link`, а не `display_name`), а у бота нет
 * `last_action_at`, поэтому подпись только «В сети»/«Не в сети» без
 * «был(а) …». Клик, как у пользователя, уважает переданный форме `callback`.
 *
 * `data-id` обязателен для скролла: по нему ScrollManager находит якорь
 * при вставке prev-пачки в начало списка (см. functions/load_section.ts).
 *
 * Фабрика возвращает готовый DOM-элемент: `createBotItem(form, data)`.
 *
 * @param form - Экземпляр формы поиска.
 * @param data - Данные записи.
 * @returns Готовый DOM-элемент строки.
 ***************************************************************************
 */
export function createBotItem(form: Search, data: SearchRecord): HTMLElement {

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
                    <span data-link class="font-semibold truncate"></span>
                    <span data-is-online class="text-secondary"></span>
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
            const link = element.querySelector<HTMLElement>(":scope [data-link]");
            const subtitle = element.querySelector<HTMLElement>(":scope [data-is-online]");

            // Аватар
            const avatarEl = new Avatars({
                element: avatar,
                id: next.id,
                name: next.link,
                image: next.avatar,
                size: "xl"
            });

            // Точка онлайна на аватаре
            avatarEl.setStatus(next.is_online ? "online" : "offline");

            // Название: публичная ссылка, а не display_name
            if (link) link.textContent = next.link ?? "";

            // Подпись: у бота нет last_action_at — только два состояния
            const texts = I18n.tree.forms.search._components.bots;
            if (subtitle && texts) {
                subtitle.textContent = next.is_online
                    ? (texts.online ?? "")
                    : (texts.not_online ?? "");
            }

            // Подсветка подписи фирменным цветом, когда бот онлайн: та же
            // вкладка, тот же смысл, что и у пользователей
            if (subtitle) {
                const brand = ["text-[var(--color-brand)]", "dark:text-[var(--color-brand)]"];
                if (next.is_online) {
                    subtitle.classList.add(...brand);
                    subtitle.classList.remove("text-secondary");
                } else {
                    subtitle.classList.remove(...brand);
                    subtitle.classList.add("text-secondary");
                }
            }

        } catch (error) {

            // Рендер строки — не пользовательское действие: тост здесь был бы
            // шумом на каждом догруженном элементе списка
            Logger.error("[app][search][createBotItem]:", error);

        }

    }

    /**
     * ***************************************************************************
     * Обработчики: открытие профиля бота по клику.
     * ***************************************************************************
     */
    function actions(): void {

        // Открыть профиль бота, поднимая уже открытый. Если форме передан
        // callback — отдаём запись наружу, форма-владелец сама решит,
        // что делать
        element.addEventListener("click", () => {

            if (form?.callback) {
                form.callback(data);
                return;
            }

            const instance = BotProfile.instances.get(data.id);
            if (instance) {
                instance?.modal?.activate();
            } else {
                new BotProfile({
                    botId: data.id,
                    options: {
                        insertInto: document.querySelector(".cdm-form.home .middle >.form-container")
                    }
                });
            }

        });

    }

}
