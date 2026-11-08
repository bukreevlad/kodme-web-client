// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем forms
import { GroupProfileModerator } from "../dialogs/profile-moderator/index.js";

// Импортируем типы
import { isGroupModeratorRecord } from "../types.js";
import type { GroupModeratorsManager } from "../index.js";
import type { GroupModeratorRecord } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * MODERATOR_ITEM - строка модератора в списке менеджера модераторов группы.
 *
 * Строка подписывается на `item::updated::<id>` локального стора формы и
 * держит ссылку на себя в `data.__domElements__`, чтобы стор удалил все
 * копии разом. Клик по строке открывает диалог настроек модератора.
 * ***************************************************************************
 */
export class ModeratorItem {

    /** Форма-владелец строки. */
    form: GroupModeratorsManager;

    /** Данные строки (запись модератора из стора). */
    data: GroupModeratorRecord;

    /** DOM-элемент строки. */
    element: HTMLElement;

    /**
     * ***************************************************************************
     * Создать строку модератора.
     * @param form - Форма-владелец.
     * @param data - Данные модератора.
     * ***************************************************************************
     */
    constructor(form: GroupModeratorsManager, data: GroupModeratorRecord) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Записываем ссылку на dom элемент
        if (!this.data.__domElements__) {
            this.data.__domElements__ = [];
        }
        this.data.__domElements__.push(this.element);

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

        // Подписываем на обновление
        this._subscribeToUpdates();

    }

    // ***************************************************************************
    // Шаблон элемента (Private Method)
    // Используем DOMParser для безопасного и чистого создания элемента
    // ***************************************************************************
    _template(): HTMLElement {

        // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
        const element = new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 p-2 items-center rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
                <div class="cdm-avatar relative"></div>
                <div class="flex flex-row justify-between w-full overflow-hidden">
                    <div class="flex flex-col gap-0 justify-center items-start w-full">
                        <div class="flex flex-col gap-0 justify-between items-start">
                            <span data-display-name class="flex flex-1 font-semibold truncate"></span>
                            <div class="flex flex-row gap-2">
                                <div data-can-deleted-message 
                                    class="flex p-1 text-xs rounded-md bg-[var(--color-black)]/5 text-secondary dark:bg-[var(--color-white)]/10 dark:text-secondary data-[active=true]:bg-[var(--color-brand)] data-[active=true]:text-white data-[active=true]:dark:bg-[var(--color-brand)]">
                                    ${t("forms.group_moderators_manager.components.user.can_deleted_message")}
                                </div>

                                <div data-can-clean-messages 
                                    class="flex p-1 text-xs rounded-md bg-[var(--color-black)]/5 text-secondary dark:bg-[var(--color-white)]/10 dark:text-secondary data-[active=true]:bg-[var(--color-brand)] data-[active=true]:text-white data-[active=true]:dark:bg-[var(--color-brand)]">
                                    ${t("forms.group_moderators_manager.components.user.can_clean_messages")}
                                </div>

                                <div data-can-restrict-members 
                                    class="flex p-1 text-xs rounded-md bg-[var(--color-black)]/5 text-secondary dark:bg-[var(--color-white)]/10 dark:text-secondary data-[active=true]:bg-[var(--color-brand)] data-[active=true]:text-white data-[active=true]:dark:bg-[var(--color-brand)]">
                                    ${t("forms.group_moderators_manager.components.user.can_restrict_members")}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
        if (!element) throw new Error("Не найден шаблон: .item");

        return element;

    }

    // ***************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // ***************************************************************************
    _setup(data: GroupModeratorRecord): void {

        try {

            // Устанавливаем элементы
            let avatar = this.element.querySelector<HTMLElement>(":scope .cdm-avatar");
            let name = this.element.querySelector<HTMLElement>(":scope [data-display-name]");

            // Устанавливаем элементы
            let canDeletedMessage = this.element.querySelector<HTMLElement>(`:scope [data-can-deleted-message]`);
            let canCleanMessages = this.element.querySelector<HTMLElement>(`:scope [data-can-clean-messages]`);
            let canRestrictMembers = this.element.querySelector<HTMLElement>(`:scope [data-can-restrict-members]`);

            // Аватар
            new Avatars({
                element: avatar,
                id: data.user_id,
                name: data.display_name,
                image: data.avatar,
                size: "lg"
            });

            // Отображаем данные
            if (name) name.textContent = data.display_name ?? null;

            // dataset принимает строку — String() даёт "true"/"false"
            if (canDeletedMessage) canDeletedMessage.dataset.active = String(!!data?.can_deleted_message);
            if (canCleanMessages) canCleanMessages.dataset.active = String(!!data?.can_clean_messages);
            if (canRestrictMembers) canRestrictMembers.dataset.active = String(!!data?.can_restrict_members);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики (Private Method)
    // ***************************************************************************
    _actions(): void {

        // Открыть настройки модератора
        this.element?.addEventListener("click", () => new GroupProfileModerator({
            userId: this.data.user_id,
            channelId: this.form.channelId
        }));

    }

    // ***************************************************************************
    // ПУБЛИЧНЫЙ МЕТОД: Обновление элемента
    // @param data - Новые данные модератора.
    // ***************************************************************************
    update(data: GroupModeratorRecord): void {

        // Сохраняем актуальные данные
        this.data = data;

        // Передаем новые данные в _setup, чтобы перерисовать DOM
        this._setup(data);

    }

    // ***************************************************************************
    // Подписка на точечное событие обновления (Private Method)
    // ***************************************************************************
    _subscribeToUpdates(): void {

        try {

            // Подписываемся и сохраняем функцию отписки.
            // Шаблон передаётся в вызов напрямую — промежуточная const
            // схлопнула бы шаблонный литерал в string, не проходящий
            // в тип события стора
            let unsubscribe = this.form.store.on(`item::updated::${this.data.id}`, (data) => {

                // Пейлоад типизирован как unknown: перерисовываем строку
                // только если пришла запись модератора
                if (isGroupModeratorRecord(data)) this.update(data);

            });

            // Сохраняем функцию отписки в data, чтобы стор мог вызвать её при удалении
            this.data.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    }

}
