// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { DurationFormatter } from "../../../utils/date/duration_formatter.js";

// Импортируем functions
import { getSessionUserId } from "../../main/functions/session_identity.js";

// Импортируем типы
import type { SystemActionPayload, SystemMessagesLocale } from "./types.js";

/**
 * Источник данных системного сообщения: разбору нужны только action_type
 * и action_payload (остальные поля сообщения не читаются).
 */
export interface SystemMessageSource {

    /** Тип системного события. */
    action_type?: string | null | undefined;

    /** Payload системного события. */
    action_payload?: SystemActionPayload | null | undefined;

    /** Отображаемое имя автора сообщения (fallback для {{user_name}}). */
    display_name?: string | null | undefined;

    /** Id автора сообщения (у звонка — инициатор; от него зависит направление). */
    author_id?: string | null | undefined;

    /** Прочие поля сообщения (не читаются парсером). */
    [key: string]: unknown;

}

/**
 * ***************************************************************************
 * Определить ключ шаблона системного сообщения в ветке system_messages.
 *
 * У звонка (action_type = "CALL") текст зависит от статуса в payload
 * (ringing → missed | declined | canceled | finished), а для статусов
 * «идёт вызов» и «разговор состоялся» — ещё и от направления: автор
 * сообщения инициировал звонок, значит для него он исходящий.
 * @param message - Объект системного сообщения.
 * @returns Ключ шаблона либо "" (событие без действия).
 * ***************************************************************************
 */
export function resolveSystemLocaleKey(message: SystemMessageSource): string {

    const action = message.action_type;
    if (!action) return "";

    // Обычные события ключуются по типу действия
    if (action !== "CALL") return action;

    // Звонок: статус живёт в payload, по умолчанию — идёт вызов
    const payload = message.action_payload || {};
    const status = typeof payload.status === "string" ? payload.status : "ringing";

    // Звонящие статусы различают направление (автор сообщения — инициатор)
    if (status === "ringing" || status === "finished") {
        const isOutgoing = typeof message.author_id === "string" && message.author_id === getSessionUserId();
        return `CALL_${isOutgoing ? "out" : "in"}_${status}`;
    }

    return `CALL_${status}`;

}

/**
 * ***************************************************************************
 * parseSystemMessage - парсер системных сообщений: подставляет поля payload
 * в шаблон локали вида {{имя_переменной}}.
 * @param message - Объект сообщения из БД (содержит action_type и action_payload).
 * @param locale - Ветка локализации system_messages.
 * @returns Отрендеренная строка ("" при отсутствии шаблона или ошибке).
 * ***************************************************************************
 */
export function parseSystemMessage(message: SystemMessageSource | null | undefined, locale: SystemMessagesLocale | null | undefined): string {

    try {

        // Базовые проверки, чтобы не упасть
        if (!message || !locale) return "";

        // Получаем данные системного сообщения
        const { action_payload } = message;

        // Ключ шаблона: у звонка он зависит от статуса и направления
        const localeKey = resolveSystemLocaleKey(message);

        // Если это обычное текстовое сообщение, а не системное событие
        if (!localeKey) return "";

        // Ищем строку шаблона. Защищаемся от ситуации, если ветка system_messages не передана напрямую
        const systemMessages = locale;
        const template = systemMessages[localeKey]?.string;

        // Если для такого ключа шаблона нет перевода, возвращаем пустую строку или дефолт
        if (!template) {
            Logger.warn(`Template for action type "${localeKey}" not found in locale.`);
            return "";
        }

        // Если payload пустой, возвращаем шаблон как есть (или пустую строку)
        const data = action_payload || {};

        // Регулярное выражение ищет конструкции вида {{имя_переменной}}
        // g - искать все совпадения, а не только первое
        return template.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {

            // Значение из payload; у старых сообщений payload без user_name —
            // подставляем имя автора сообщения (display_name)
            let value = data[key] ?? (key === "user_name" ? message.display_name : undefined);

            // Длительность звонка хранится в секундах — выводим как M:SS
            if (key === "duration" && typeof value === "number") {
                value = new DurationFormatter(value * 1000).getFormattedDuration({ includeSeconds: true, includeDays: false });
            }

            // Если значения нет, оставляем плейсхолдер
            return value !== undefined ? String(value) : match;
        });

    } catch (error) {
        Logger.error(error);
        return "";
    }

}
