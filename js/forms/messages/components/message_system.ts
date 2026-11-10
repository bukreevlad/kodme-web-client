// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { DurationFormatter } from "../../../utils/date/duration_formatter.js";

// Импортируем forms
import { BotProfile } from "../../bot-profile/index.js";
import { UserProfile } from "../../user-profile/index.js";
import { BroadcastPlay } from "../../broadcast-play/index.js";

// Импортируем типы
import type { MessageData, SystemMessagesLocale } from "./types.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * Конфигурация рендера одного типа системного события.
 */
interface SystemActionConfig {

    /** HTML события (шаблонная строка из локали и payload). */
    html: string;

    /** Доживка кликов поверх вставленного шаблона. */
    bindEvents?: (tpl: Element) => void;

}

/**
 * ***************************************************************************
 * createSystemMessage - фабрика системного сообщения: центрированная плашка
 * с событием («вошёл в группу», «трансляция завершена», «звонок» …).
 *
 * Возвращает готовый элемент для вставки в DOM; класса-обёртки больше нет —
 * публичных методов у плашки не было (мёртвые update/getDOM/getgetData удалены),
 * форма в данных события не участвует.
 * @param data - Данные системного сообщения.
 * @returns DOM-элемент системного сообщения.
 * ***************************************************************************
 */
export function createSystemMessage(data: MessageData): HTMLElement {

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Отображаем элемент (для обновления/удаления по Store)
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(element, data);

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента.
 * Используем DOMParser для безопасного и чистого создания элемента.
 * @returns DOM-элемент системного сообщения.
 * ***************************************************************************
 */
function template(): HTMLElement {
    // invariant: корневой [data-system-message] входит в сам шаблон —
    // querySelector с текстовым HTML всегда находит его
    return createElementFromString(`
        <div data-system-message class="item flex w-full my-2 justify-center">
            <div data-template class="flex p-1 px-2 bg-white/50 dark:bg-white/10 justify-center font-semibold text-sm rounded-md shadow-sm"></div>
        </div>
    `).querySelector<HTMLDivElement>("[data-system-message]")!;
}

/**
 * ***************************************************************************
 * Вспомогательный метод, убирающий дублирование DOMParser.
 * @param htmlString - HTML-строка.
 * @returns Разобранный документ.
 * ***************************************************************************
 */
function createElementFromString(htmlString: string): Document {
    return new DOMParser().parseFromString(htmlString, "text/html");
}

/**
 * ***************************************************************************
 * Установка/Перерисовка данных.
 * @param element - DOM-элемент сообщения.
 * @param data - Данные сообщения.
 * ***************************************************************************
 */
function setup(element: HTMLElement, data: MessageData): void {
    try {
        element.setAttribute("data-id", data.id);

        const rootTpl = element.querySelector("[data-template]");
        const messageTpl = parseTemplateMessage(data);

        if (rootTpl && messageTpl) {
            rootTpl.innerHTML = ''; // Очищаем старое содержимое при обновлении
            rootTpl.append(messageTpl);
        }
    } catch (error) {
        Logger.error(error);
    }
}

/**
 * ***************************************************************************
 * Хелпер для открытия профиля пользователя или бота.
 *
 * Ветки разделены: BotProfile принимает только botId и бросает
 * «Не передан: botId» при передаче { userId }.
 * @param userId - Id пользователя (у бота он же botId).
 * @param isBot - Профиль бота.
 * ***************************************************************************
 */
function openProfile(userId?: string, isBot?: boolean): void {

    // Без id профиль не открыть (раньше конструктор форм падал с «Не передан»)
    if (!userId) return;

    if (isBot) {
        const instance = BotProfile.instances.get(userId);

        if (instance) {
            instance?.modal?.activate();
        } else {
            new BotProfile({ botId: userId });
        }

        return;
    }

    const instance = UserProfile.instances.get(userId);

    if (instance) {
        instance?.modal?.activate();
    } else {
        new UserProfile({ userId });
    }
}

/**
 * ***************************************************************************
 * Хелпер для открытия трансляции.
 * @param castId - Id трансляции.
 * ***************************************************************************
 */
function openBroadcast(castId?: string): void {

    // Без id трансляцию не открыть (раньше конструктор форм падал с «Не передан»)
    if (!castId) return;

    const instance = BroadcastPlay.instances.get(castId);
    if (instance) {
        instance?.modal?.activate();
    } else {
        new BroadcastPlay({ castId });
    }
}

/**
 * ***************************************************************************
 * Главный маппер системных сообщений.
 * @param data - Данные сообщения.
 * @returns Готовый к вставке элемент либо null (нет обработчика события).
 * ***************************************************************************
 */
function parseTemplateMessage(data: MessageData): Element | null {

    // Устанавливаем параметры
    const action = data.action_type;
    const payload = data.action_payload;

    // Без типа события и payload сопоставлять нечего
    if (!action || !payload) return null;

    // Быстрый доступ к локализации
    const locales: SystemMessagesLocale = I18n.tree.forms.messages.components.messages.system_messages;
    const messageLocale = locales[action]?.array;

    // Если локализация не найдена
    if (!messageLocale) return null;

    // Общий конфиг присоединения — переиспользуется для выхода и смены роли.
    // Имя/бот: у старых сообщений payload без user_name/is_bot — берём
    // имя автора сообщения (у событий вступления/выхода/переименования
    // автор совпадает с payload.user_id)
    const joinedConfig = (): SystemActionConfig => ({
        html: `<div data-template class="flex flex-row gap-1">
                    <span data-link class="underline cursor-pointer">${payload.user_name ?? data.display_name ?? ""}</span>
                    <span>${messageLocale}</span>
                   </div>`,
        bindEvents: (tpl) => tpl.querySelector("[data-link]")?.addEventListener("click", () => openProfile(payload.user_id, payload.is_bot ?? data.is_bot))
    });

    // Декларативно описываем конфигурацию для каждого типа экшена
    const actionsMap: Record<string, () => SystemActionConfig> = {
        USER_JOINED_GROUP: joinedConfig,

        USER_LEFT_GROUP: joinedConfig, // Поведение идентично

        USER_ROLE_CHANGED_TO_MODERATOR_IN_GROUP: joinedConfig, // Поведение идентично

        USER_ROLE_CHANGED_TO_USER_IN_GROUP: joinedConfig, // Поведение идентично

        USER_RENAMED_GROUP: () => ({
            html: `<div data-template class="flex flex-row gap-1">
                    <span data-link class="underline cursor-pointer">${payload.user_name ?? data.display_name ?? ""}</span>
                    <span>${messageLocale} ${payload.group_name}</span>
                   </div>`,
            bindEvents: (tpl) => tpl.querySelector("[data-link]")?.addEventListener("click", () => openProfile(payload.user_id, false))
        }),

        BROADCAST_STARTED: () => ({
            html: `<div data-template class="flex flex-row gap-2">
                    <span data-link class="underline cursor-pointer">${messageLocale[0]}</span>
                    <span>${messageLocale[1]}</span>
                   </div>`,
            bindEvents: (tpl) => tpl.querySelector("[data-link]")?.addEventListener("click", () => openBroadcast(payload.cast_id))
        }),

        BROADCAST_ENDED: () => {
            // Отсутствующие отметки времени дают NaN — нормализация ""
            const durationInMs = Date.parse(payload.ended_at ?? "") - Date.parse(payload.started_at ?? "");
            const duration = new DurationFormatter(durationInMs).getFormattedDuration({ includeSeconds: true, includeDays: false });

            return {
                html: `<div data-template class="flex flex-row gap-2">
                        <span data-link class="underline cursor-pointer">${messageLocale[0]}</span>
                        <span>${messageLocale[1]} - ${duration}</span>
                       </div>`,
                bindEvents: (tpl) => tpl.querySelector("[data-link]")?.addEventListener("click", () => openBroadcast(payload.cast_id))
            };
        },

        CALL_INCOMING: () => ({
            html: `<div data-template class="flex flex-row gap-1">
                    <span data-link class="underline cursor-pointer">${payload.display_name || payload.user_name}</span>
                    <span>${messageLocale}</span>
                   </div>`,
            bindEvents: (tpl) => tpl.querySelector("[data-link]")?.addEventListener("click", () => openProfile(payload.user_id, false))
        }),

        CALL_ENDED: () => {

            // Длительность звонка берём из отметки приёма: до неё разговор
            // не начинался, а отсчёт от старта включал бы ещё и прозвон
            const durationInMs = Date.parse(payload.ended_at ?? "") - Date.parse(payload.accepted_at ?? "");
            const duration = new DurationFormatter(durationInMs).getFormattedDuration({ includeSeconds: true, includeDays: false });

            return {
                html: `<div data-template class="flex flex-row gap-1">
                        <span>${messageLocale}</span>
                        <span data-link class="underline cursor-pointer">${payload.user_name || payload.display_name}</span>
                        <span>${duration}</span>
                       </div>`,
                bindEvents: (tpl) => tpl.querySelector("[data-link]")?.addEventListener("click", () => openProfile(payload.user_id, false))
            };
        },

        CALL_MISSED: () => ({
            html: `<div data-template class="flex flex-row gap-1">
                    <span>${messageLocale}</span>
                    <span data-link class="underline cursor-pointer">${payload.user_name || payload.display_name}</span>
                   </div>`,
            bindEvents: (tpl) => tpl.querySelector("[data-link]")?.addEventListener("click", () => openProfile(payload.user_id, false))
        })
    };

    // Если у нас есть обработчик для такого action
    if (actionsMap[action]) {
        const config = actionsMap[action]();
        // [data-template] входит в каждый html из actionsMap
        const tpl = createElementFromString(config.html).querySelector("[data-template]");

        if (config.bindEvents && tpl) {
            config.bindEvents(tpl);
        }

        return tpl;
    }

    return null;

}
