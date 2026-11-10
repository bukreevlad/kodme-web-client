// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";

// Импортируем handlers
import { copyInviteHandler } from "./handlers/copy_invite.js";
import { removeInviteHandler } from "./handlers/remove_invite.js";

// Импортируем типы
import { isBroadcastInvite } from "../types.js";
import type { StoreEventName } from "../../../utils/store.js";
import type { BroadcastInvite } from "../types.js";
import type { BroadcastManageInvites } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * createInviteItem - строка приглашения в списке.
 *
 * Отображает название и ссылку приглашения: клик по строке копирует ссылку
 * в буфер обмена, кнопка-корзина отзывает приглашение (с подтверждением).
 * Строка живёт в data.__domElements__ (для удаления копий при выгрузке
 * из стора) и подписывается на точечное событие обновления записи.
 *
 * Фабрика возвращает готовый DOM-элемент: `createInviteItem(form, data)`.
 *
 * @param form - Экземпляр формы приглашений.
 * @param data - Данные приглашения.
 * @returns Готовый DOM-элемент строки.
 * ***************************************************************************
 */
export function createInviteItem(form: BroadcastManageInvites, data: BroadcastInvite): HTMLElement {

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

    // Подписываемся на обновление
    subscribeToUpdates();

    // Возвращаем сам элемент для вставки в DOM
    return element;

    /**
     * ***************************************************************************
     * Шаблон элемента: DOMParser создаёт DOM без innerHTML.
     * @returns DOM-элемент строки приглашения.
     * ***************************************************************************
     */
    function template(): HTMLElement {

        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 items-center p-2 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer rounded-lg">
                <div class="flex flex-col gap-0 min-w-0 flex-1">
                    <span data-name class="truncate"></span>
                    <span data-link class="text-sm text-secondary truncate"></span>
                </div>
                ${Buttons.transparent({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-revoke", "title=" + t("forms.broadcast_manage_invites.dialogs.revoke.action_remove"), "aria-label=" + t("forms.broadcast_manage_invites.dialogs.revoke.action_remove")],
            icon: "trash"
        })}
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Новые данные приглашения.
     * ***************************************************************************
     */
    function setup(next: BroadcastInvite): void {

        try {

            // Сохраняем актуальные данные
            current = next;

            // Устанавливаем элементы: invariant — все data-* селекторы ниже
            // есть в шаблоне template(), строка создана из него же
            let name = element.querySelector<HTMLElement>(":scope [data-name]");
            let link = element.querySelector<HTMLElement>(":scope [data-link]");

            // Отображаем данные
            if (name) name.textContent = next.name;
            if (link) link.textContent = next.link;

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Обработчики: копирование ссылки по клику на строку, отзыв приглашения
     * по кнопке-корзине (клик по кнопке не копирует ссылку).
     * ***************************************************************************
     */
    function actions(): void {

        // Скопировать ссылку
        element.addEventListener("click", () => copyInviteHandler(current));

        // Отозвать приглашение
        let revoke = element.querySelector("[action-revoke]");
        revoke?.addEventListener("click", (event) => {
            event.stopPropagation();
            removeInviteHandler(form, current);
        });

    }

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления приглашения.
     * ***************************************************************************
     */
    function subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события
            let itemUpdatedEvent: StoreEventName = `item::updated::${current.id}`;

            // Подписываемся и сохраняем функцию отписки
            let unsubscribe = form.store.on(itemUpdatedEvent, (payload) => {

                // Стор шлёт payload как unknown — сверяемся guard'ом
                if (!isBroadcastInvite(payload)) return;

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
