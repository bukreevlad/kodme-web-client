// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { SystemActionPayload, SystemMessagesLocale } from "./types.js";

/**
 * Источник данных системного сообщения: разбору нужны только action_type
 * и action_payload (остальные поля сообщения не читаются).
 */
export interface SystemMessageSource {

    /** Тип системного события. */
    action_type?: string;

    /** Payload системного события. */
    action_payload?: SystemActionPayload | null;

    /** Отображаемое имя автора сообщения (fallback для %{user_name}%). */
    display_name?: string;

    /** Прочие поля сообщения (не читаются парсером). */
    [key: string]: unknown;

}

/**
 * ***************************************************************************
 * parseSystemMessage - парсер системных сообщений: подставляет поля payload
 * в шаблон локали вида %{имя_переменной}%.
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
        const { action_type, action_payload } = message;

        // Если это обычное текстовое сообщение, а не системное событие
        if (!action_type) return "";

        // Ищем строку шаблона. Защищаемся от ситуации, если ветка system_messages не передана напрямую
        const systemMessages = locale;
        const template = systemMessages[action_type]?.string;

        // Если для такого action_type нет перевода, возвращаем пустую строку или дефолт
        if (!template) {
            Logger.warn(`Template for action type "${action_type}" not found in locale.`);
            return "";
        }

        // Если payload пустой, возвращаем шаблон как есть (или пустую строку)
        const data = action_payload || {};

        // Регулярное выражение ищет конструкции вида %{имя_переменной}%
        // g - искать все совпадения, а не только первое
        return template.replace(/%\{([\w_]+)\}%/g, (match, key) => {

            // Значение из payload; у старых сообщений payload без user_name —
            // подставляем имя автора сообщения (display_name)
            const value = data[key] ?? (key === "user_name" ? message.display_name : undefined);

            // Если значения нет, оставляем плейсхолдер
            return value !== undefined ? String(value) : match;
        });

    } catch (error) {
        Logger.error(error);
        return "";
    }

}
