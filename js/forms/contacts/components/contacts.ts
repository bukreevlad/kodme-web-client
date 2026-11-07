// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { TimeAgoFormatter } from "../../../utils/date/time_ago_formatter.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем forms
import { UserProfile } from "../../user-profile/index.js";

// Импортируем типы
import { isContactRecord } from "../types.js";
import type { ContactRecord } from "../types.js";
import type { Contacts } from "../index.js";

/**
 * ***************************************************************************
 * Строка списка контактов.
 *
 * Компонент самостоятельный (как строки в других формах): шаблон, селекторы,
 * подпись и клик живут здесь, общей базы нет. Подписи онлайна берутся из
 * раздела локализации поиска — общий текст «В сети»/«Был(а) …».
 *
 * Фабрика возвращает готовый DOM-элемент (легаси-конструктор возвращал
 * элемент вместо this — в TS такой паттерн не типизируется честно):
 * `createContactItem(form, data)`.
 *
 * @param form - Экземпляр формы контактов.
 * @param data - Данные записи.
 * @returns Готовый DOM-элемент строки.
 ***************************************************************************
 */
export function createContactItem(form: Contacts, data: ContactRecord): HTMLElement {

    // Записываем данные: _setup обновляет ссылку, как раньше это делал this.data
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
     * Шаблон элемента. Используем DOMParser для безопасного и чистого создания
     * элемента.
     * @returns DOM-элемент строки.
     * ***************************************************************************
     */
    function template(): HTMLElement {

        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 p-2 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg cursor-pointer">
                <div class="cdm-avatar relative"></div>
                <div class="flex flex-col gap-1 self-center">
                    <span data-display-name class="font-semibold truncate"></span>
                    <span data-is-online class="text-secondary"></span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Новые данные записи.
     * ***************************************************************************
     */
    function setup(next: ContactRecord): void {

        try {

            // Сохраняем актуальные данные
            current = next;

            // Устанавливаем элементы
            const avatar = element.querySelector<HTMLElement>(":scope >.cdm-avatar");
            const name = element.querySelector<HTMLElement>(":scope [data-display-name]");
            const isOnline = element.querySelector<HTMLElement>(":scope [data-is-online]");

            // Аватар
            new Avatars({
                element: avatar,
                id: next.id,
                name: next.display_name,
                image: next.avatar,
                size: "lg"
            });

            // Имя
            if (name) name.textContent = next.display_name ?? null;

            // В сети
            if (isOnline) {
                isOnline.textContent = next.is_online ? window._lc.forms.search._components.users.online :
                    next.last_action_at ? `${window._lc.forms.search._components.users.was} ${new TimeAgoFormatter(next.last_action_at).formattedTime}`
                        : window._lc.forms.search._components.users.not_online;
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Обработчики: открытие профиля пользователя по клику.
     * ***************************************************************************
     */
    function actions(): void {

        // Открыть профиль
        element.addEventListener("click", () => new UserProfile({
            userId: current.id,
            options: {
                insertInto: document.querySelector<HTMLElement>(".cdm-form.home .left")
            }
        }));

    }

    /**
     * ***************************************************************************
     * Обновление элемента: передаём новые данные в setup, чтобы перерисовать DOM.
     * @param payload - Полезная нагрузка события обновления.
     * ***************************************************************************
     */
    function update(payload: unknown): void {

        // Стор шлёт payload как unknown — сверяемся guard'ом
        if (!isContactRecord(payload)) return;

        // Передаем новые данные в setup, чтобы перерисовать DOM
        setup(payload);

    }

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления записи.
     * ***************************************************************************
     */
    function subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события
            const itemUpdatedEvent: `item::updated::${string}` = `item::updated::${current.id}`;

            // Подписываемся и сохраняем функцию отписки
            const unsubscribe = form.store.on(itemUpdatedEvent, (payload) => {
                update(payload);
            });

            // Сохраняем функцию отписки в data, чтобы форма могла вызвать её при удалении
            current.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    }

}
