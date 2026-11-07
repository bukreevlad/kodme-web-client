// Импортируем utils
import { Logger } from "../utils/logs/logger.js";

// Импортируем forms
import { BroadcastPlay } from "../forms/broadcast-play/index.js";
import { CallIncoming } from "../forms/call-incoming/index.js";
import { Messages } from "../forms/messages/index.js";
import { SecretChat } from "../forms/secret-chat/index.js";
import { UserProfile } from "../forms/user-profile/index.js";

/** Параметры роута: значения строковых query-параметров URL. */
type RouteParams = Record<string, string>;

/** Типы форм, открываемых роутером deep-link'ов. */
type RoutedForm = CallIncoming | Messages | SecretChat | BroadcastPlay | UserProfile;

/**
 * Описание одного маршрута: ключ — имя query-параметра, render — открытие
 * формы по этим параметрам.
 */
interface RouteDefinition {

    /** Открывает форму роута по параметрам URL. */
    render: (params: RouteParams) => RoutedForm;

}

/**
 * ***************************************************************************
 * Карта маршрутов: render принимает параметры URL.
 *
 * Ключ — имя query-параметра, при наличии которого роут открывается
 * (например, `/?callId=…` — deep-link входящего звонка из push-уведомления).
 * ***************************************************************************
 */
export const ROUTES: Record<string, RouteDefinition> = {

    // Входящий звонок (deep-link из push-уведомления: /?callId=…)
    callId: {
        render: (params) => new CallIncoming({
            callId: params.callId ?? "",
            userId: params.userId,
            displayName: params.displayName,
            avatar: params.avatar
        })
    },

    // Сообщение (deep-link из push-уведомления: /?channelId=…;
    // параметр comment при наличии просто открывает канал — форма Messages
    // пока не умеет прокручивать к конкретному комментарию)
    channelId: {
        render: (params) => new Messages({
            channelId: params.channelId ?? ""
        })
    },

    // Секретный чат (deep-link: /?secretChatId=…; push-уведомлений о
    // сообщениях секретных чатов нет — сервер о них не знает)
    secretChatId: {
        render: (params) => new SecretChat({
            chatId: params.secretChatId ?? ""
        })
    },

    // Трансляция (deep-link из push-уведомления: /?broadcastId=…)
    broadcastId: {
        render: (params) => new BroadcastPlay({
            castId: params.broadcastId ?? ""
        })
    },

    // Профиль пользователя (deep-link из push-уведомлений о входе:
    // /?profileId=…; ключ не userId — тот вспомогательный в пушах звонков
    // и открыл бы профиль при клике на уведомление звонка)
    profileId: {
        render: (params) => new UserProfile({
            userId: params.profileId ?? ""
        })
    }

};

/**
 * ***************************************************************************
 * Открывает формы, чьи ключи присутствуют в переданных параметрах.
 *
 * Общая точка рендера: используется и при старте приложения (параметры из
 * URL страницы), и при клике по уведомлению при открытом приложении
 * (параметры из data.url уведомления). Ошибка одной формы не прерывает
 * открытие остальных.
 * @param {RouteParams} params - Параметры роута (query-параметры URL).
 * ***************************************************************************
 */
export function renderRoutes(params: RouteParams): void {

    // Находим все ключи из ROUTES, которые есть в params (и не пусты)
    const matchedKeys = Object.keys(ROUTES).filter((key) => {
        return key in params && params[key] !== "";
    });

    const instances: RoutedForm[] = [];

    // Безопасно запускаем render для каждого совпадения
    matchedKeys.forEach((key) => {
        try {
            const route = ROUTES[key];
            if (!route) return;
            const instance = route.render(params);
            instances.push(instance);
            Logger.debug(`[app][router]: Форма [${key}] успешно создана`, instance);
        } catch (error) {
            // Выводится точная ошибка с именем упавшего роута
            Logger.error(`[app][router]: Ошибка при открытии формы [${key}]:`, error);
        }
    });

    Logger.debug("[app][router]: Итого открытые инстансы", instances);

}

/**
 * ***************************************************************************
 * Открывает формы, чьи ключи присутствуют в query-параметрах URL страницы.
 *
 * Извлекает параметры запуска из текущего URL и запускает renderRoutes.
 * Вызывается при загрузке приложения (см. forms/home/index.ts).
 * ***************************************************************************
 */
export function initRoutes(): void {

    // Извлекаем параметры из текущего URL
    const searchParams = new URLSearchParams(window.location.search);
    const params: RouteParams = Object.fromEntries(searchParams.entries());

    Logger.debug("[app][router]: Параметры запуска", params);

    // Запускаем открытие форм по параметрам
    renderRoutes(params);

}

/**
 * ***************************************************************************
 * Подписка на клики по push-уведомлениям при открытом приложении.
 *
 * Service Worker при клике по уведомлению присылает сообщение
 * FOCUS_NOTIFICATION_CLICK с данными уведомления (в т.ч. url deep-link'а).
 * Раньше сообщение никем не обрабатывалось — окно лишь получало фокус.
 * Теперь параметры url разбираются и открываются через общий renderRoutes.
 * ***************************************************************************
 */
export function initNotificationRouter(): void {

    // Без SW (например, в обёртках без его поддержки) подписываться не на что
    if (!("serviceWorker" in navigator)) return;

    // Слушаем сообщения от Service Worker
    navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {

        try {

            // Интересует только сообщение клика по уведомлению
            const message = event.data as { type?: string; data?: { url?: string } } | null;
            if (message?.type !== "FOCUS_NOTIFICATION_CLICK") return;

            // Извлекаем deep-link уведомления (например, /?channelId=…)
            const url = message.data?.url;
            if (!url) return;

            // Разбираем query-параметры ссылки
            const params: RouteParams = Object.fromEntries(
                new URL(url, window.location.origin).searchParams.entries()
            );

            Logger.debug("[app][router]: Клик по уведомлению, параметры", params);

            // Открываем формы по параметрам уведомления
            renderRoutes(params);

        } catch (error) {
            Logger.error("[app][router]: Ошибка обработки клика по уведомлению:", error);
        }

    });

}
