// Импортируем utils
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Logger } from "../../../utils/logs/logger.js";
import { GestureController } from "../../../utils/gesture_controller.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем forms
import { UserProfile } from "../../user-profile/index.js";
import { BotProfile } from "../../bot-profile/index.js";

// Импортируем handlers
import { openModerationMenu } from "./handlers/moderation_menu.js";

// Импортируем типы
import { isMemberRecord, MemberRecord } from "../types.js";
import type { ChannelMembers } from "../index.js";
import type { StoreEventName } from "../../../utils/store.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Строка участника канала.
 *
 * Шаблон и клик — как у строки поиска по пользователям (аватар, имя,
 * @ссылка); поверх — бейджи модерации. Меню модерации вызывается долгим
 * тапом (мобильные) и правым кликом (десктоп), как у сообщений.
 *
 * `data-id` обязателен для скролла: по нему ScrollManager находит якорь
 * при вставке prev-пачки в начало списка.
 *
 * Фабрика возвращает готовый DOM-элемент: `createMemberItem(form, data)`.
 *
 * @param form - Экземпляр формы участников.
 * @param data - Данные записи.
 * @returns Готовый DOM-элемент строки.
 * ***************************************************************************
 */
export function createMemberItem(form: ChannelMembers, data: MemberRecord): HTMLElement {

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Актуальные данные строки (переприсваиваются при обновлении)
    let currentData = data;

    // Проставляем id элементу: по нему ScrollManager ищет якорь скролла
    // при вставке пачки в начало списка (см. functions/get_members.ts)
    if (data.id) element.setAttribute("data-id", data.id);

    // Регистрируем DOM-копию в реестре стора: по ней стор снимет все
    // отображённые копии (одна запись может попасть в список дважды)
    form.store.registerDomElement(data.id, element);

    // Устанавливаем начальные данные
    setup(data);

    // Прикрепляем обработчики событий и жесты
    actions();

    // Подписываемся на обновление записи в сторе
    subscribeToUpdates();

    // Возвращаем сам элемент для вставки в DOM
    return element;

    /**
     * ***************************************************************************
     * Шаблон элемента: DOMParser для безопасного создания DOM без innerHTML.
     * @returns DOM-элемент строки.
     * ***************************************************************************
     */
    function template(): HTMLElement {

        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-3 p-2 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg cursor-pointer">
                <div class="cdm-avatar relative"></div>
                <div class="flex flex-col gap-1 self-center min-w-0 flex-1">
                    <div class="flex flex-row gap-2 items-center min-w-0">
                        <span data-display-name class="font-semibold truncate"></span>
                        <span data-moderator class="hidden flex shrink-0 p-1 text-xs rounded-md bg-[var(--color-brand)] text-white dark:bg-[var(--color-brand)]">${t("forms.channel_members.components.member.moderator")}</span>
                        <span data-blocked class="hidden flex shrink-0 p-1 text-xs rounded-md bg-[var(--color-red)] text-white dark:bg-[var(--color-red)]">${t("forms.channel_members.components.member.blocked")}</span>
                    </div>
                    <span data-link class="text-secondary truncate empty:hidden"></span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/перерисовка данных.
     * @param next - Данные записи.
     * ***************************************************************************
     */
    function setup(next: MemberRecord): void {

        try {

            // Сохраняем актуальные данные
            currentData = next;

            // Устанавливаем элементы
            const avatar = element.querySelector<HTMLElement>(":scope >.cdm-avatar");
            const name = element.querySelector<HTMLElement>(":scope [data-display-name]");
            const link = element.querySelector<HTMLElement>(":scope [data-link]");
            const moderator = element.querySelector<HTMLElement>(":scope [data-moderator]");
            const blocked = element.querySelector<HTMLElement>(":scope [data-blocked]");

            // Аватар
            new Avatars({
                element: avatar,
                id: next.user_id,
                name: next.display_name,
                image: next.avatar,
                size: "xl"
            });

            // Имя
            if (name) name.textContent = next.display_name ?? "";

            // Подпись: @ссылка профиля (без неё строка пустая и скрывается)
            if (link) link.textContent = next.link ? `@${next.link}` : "";

            // Бейджи модерации: скрыты классом hidden, показ — снятием hidden
            if (moderator) moderator.classList.toggle("hidden", next.is_moderator !== true);
            if (blocked) blocked.classList.toggle("hidden", next.is_banned !== true);

        } catch (error) {

            // Рендер строки — не пользовательское действие: тост здесь был бы
            // шумом на каждом догруженном элементе списка
            Logger.error("[app][channel-members][createMemberItem]:", error);

        }

    }

    /**
     * ***************************************************************************
     * Обработчики: профиль по тапу, меню модерации по долгому тапу/ПКМ.
     *
     * Открытие профиля лежит в tap.onTap, а не в click: после долгого тапа
     * браузер генерирует синтетический click, и профиль открылся бы поверх
     * меню. У GestureController ветка tap пропускается при isLongTap.
     * ***************************************************************************
     */
    function actions(): void {

        // Открыть профиль участника, поднимая уже открытый
        new GestureController(element, {
            threshold: 5,
            onContextMenu: (event) => {
                event.preventDefault();

                // На мобильных долгое удержание порождает и contextmenu, и
                // долгий тап — меню открывает только один из них
                if (!IsMobile.get()) {
                    openModerationMenu(form, currentData, event);
                }
            },
            tap: {
                // timeout = longTapTimeout: зажатие до 500 мс — тап (профиль),
                // дольше — долгий тап (меню); зазора между ними нет
                timeout: 500,
                longTapTimeout: 500,
                onTap: () => openMemberProfile(currentData),
                onLongTap: (event) => {

                    // Долгий тап — мобильное меню; на ПК то же делает правый клик
                    if (!IsMobile.get()) return;
                    if (event.cancelable) event.preventDefault();

                    openModerationMenu(form, currentData, event);

                }
            }
        });

    }

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления записи в сторе: перерисовка
     * бейджей после блокировки/разблокировки участника.
     * ***************************************************************************
     */
    function subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события
            const itemUpdatedEvent: StoreEventName = `item::updated::${currentData.id}`;

            // Подписываемся и сохраняем функцию отписки
            const unsubscribe = form.store.on(itemUpdatedEvent, (payload) => {

                // Стор шлёт payload как unknown — сверяемся guard'ом
                if (!isMemberRecord(payload)) return;

                // Обновляем данные
                setup(payload);

            });

            // Запоминаем отписку в сторе — она вызовется при удалении элемента
            form.store.addItemSubscription(currentData.id, unsubscribe);

        } catch (error) {
            Logger.error("[app][channel-members][subscribe-to-updates]:", error);
        }

    }

}

/**
 * ***************************************************************************
 * Открыть профиль участника: у бота — профиль бота, у пользователя —
 * профиль пользователя. Уже открытая форма поднимается, а не создаётся
 * заново.
 * @param member - Участник, чей профиль открывается.
 * ***************************************************************************
 */
function openMemberProfile(member: MemberRecord): void {

    // Профиль бота принимает только botId — ветки разделены
    if (member.is_bot) {
        const botInstance = FormsRegistry.getOwner<BotProfile>(`bot-profile:${member.user_id}`);
        if (botInstance) {
            botInstance.modal?.activate();
        } else {
            new BotProfile({
                botId: member.user_id,
                options: {
                    insertInto: document.querySelector(".cdm-form.home .middle >.form-container")
                }
            });
        }
        return;
    }

    const instance = FormsRegistry.getOwner<UserProfile>(`user-profile:${member.user_id}`);
    if (instance) {
        instance.modal?.activate();
    } else {
        new UserProfile({
            userId: member.user_id,
            options: {
                insertInto: document.querySelector(".cdm-form.home .middle >.form-container")
            }
        });
    }

}
