// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем handlers
import { clickHandler } from "./handlers/click.js";

// Импортируем типы
import { isForwardChannel } from "../types.js";
import type { StoreEventName } from "../../../utils/store.js";
import type { ChannelItem, ForwardChannelRecord } from "../types.js";
import type { ForwardMessages } from "../index.js";

/**
 * ***************************************************************************
 * createChannelItem - строка канала в списке пересылки.
 *
 * Отображает аватар, название и статус строки; по клику выделяет или
 * снимает выделение (см. handlers/click.ts). Строка живёт в
 * data.__domElements__ (для удаления копий при выгрузке из стора)
 * и подписывается на точечное событие обновления записи.
 *
 * Фабрика возвращает строку-объект { form, data, element } (легаси-
 * конструктор возвращал элемент вместо this — в TS такой паттерн
 * не типизируется честно): `createChannelItem(form, data)`.
 *
 * @param form - Экземпляр формы пересылки.
 * @param data - Данные канала.
 * @returns Готовая строка списка.
 * ***************************************************************************
 */
export function createChannelItem(form: ForwardMessages, data: ForwardChannelRecord): ChannelItem {

    // Записываем данные: setup обновляет ссылку строки на актуальные данные
    let current = data;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Формируем строку списка
    const item: ChannelItem = { form, data, element };

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

    // Возвращаем строку для вставки в DOM
    return item;

    /**
     * *************************************************************************
     * Шаблон элемента: DOMParser создаёт DOM без innerHTML.
     * @returns DOM-элемент строки канала.
     * *************************************************************************
     */
    function template(): HTMLElement {

        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 p-2 items-center rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
                <div class="cdm-avatar">
                    <div data-check-icon>${Icons.icon("check")?.outerHTML ?? ""}</div>
                </div>
                <div class="flex flex-row justify-between w-full overflow-hidden">
                    <div class="flex flex-col gap-1 justify-center w-full">
                        <div class="flex flex-row gap-2 justify-between items-center">
                            <div data-name class="flex flex-row gap-2 flex-1 items-center font-semibold truncate"></div>
                            <span data-created-at class="text-sm text-muted"></span>
                        </div>
                        <span data-last-message class="text-secondary text-sm"></span>
                    </div>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * *************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Новые данные канала.
     * *************************************************************************
     */
    function setup(next: ForwardChannelRecord): void {

        try {

            // Сохраняем актуальные данные
            current = next;
            item.data = next;

            // Устанавливаем элементы: invariant — все data-* селекторы ниже
            // есть в шаблоне template(), строка создана из него же
            const avatar = element.querySelector<HTMLElement>(":scope >.cdm-avatar");
            const name = element.querySelector<HTMLElement>(":scope [data-name]");
            const lastMessage = element.querySelector<HTMLElement>(":scope [data-last-message]");

            // Без узлов строки заполнять нечего
            if (!avatar || !name || !lastMessage) return;

            // Определяем id аватара (type опционален — null в includes не попадает)
            let avatarId = next.id;

            // Если это диалог
            if (next.type != null && [1, 8].includes(next.type)) {
                avatarId = next.display_user_id ?? avatarId;
            }

            // Аватар
            const avatarInstance = new Avatars({
                element: avatar,
                id: avatarId,
                name: next.display_name,
                image: next.avatar,
                size: "xl"
            });

            // Если это избранное
            if (next.type === 5) {
                avatarInstance.setIcon("bookmark");
            }

            // Если это диалог и пользователь онлайн
            if (next.type != null && [1, 8].includes(next.type)) {
                if (next.display_user_is_online) {
                    avatarInstance.setStatus("online");
                } else {
                    avatarInstance.setStatus("offline");
                }
            }

            // Если это группа
            if (next.type === 2) {
                avatar.classList.add("cube");
            }

            // Название (display_name опционален — нормализуем к null)
            name.textContent = next.display_name ?? null;

            // Если уведомления выключены
            if (!next.is_notifications) {
                const icon = Icons.icon("BellOff");
                if (icon) name.append(icon);
            }

            // Заглушка превью: строки списка пересылки не показывают
            // текст последнего сообщения
            lastMessage.textContent = window._lc.forms.main.components.channels.last_message.empty_messages;

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * *************************************************************************
     * Обработчики: выделение строки по клику.
     * *************************************************************************
     */
    function actions(): void {

        // Выделить или снять выделение
        element.addEventListener("click", () => clickHandler(item));

    }

    /**
     * *************************************************************************
     * Подписка на точечное событие обновления канала.
     * *************************************************************************
     */
    function subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события
            const itemUpdatedEvent: StoreEventName = `item::updated::${current.id}`;

            // Подписываемся и сохраняем функцию отписки
            const unsubscribe = form.store.on(itemUpdatedEvent, (payload) => {

                // Стор шлёт payload как unknown — сверяемся guard'ом
                if (!isForwardChannel(payload)) return;

                // Передаем новые данные в setup, чтобы перерисовать строку
                setup(payload);

            });

            // Сохраняем функцию отписки в data, чтобы стор мог вызвать ее при удалении
            current.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    }

}
