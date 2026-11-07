// Импортируем components
import { Toast } from "../../components/toast.js";

// Импортируем utils
import { Logger } from "../logs/logger.js";
import { parseError } from "../network/parse_error.js";

// Импортируем типы
import type { ParsedError } from "../network/parse_error.js";

/**
 * ***************************************************************************
 * Карта «служебных» кодов в ключи локализации.
 *
 * Коды приходят с сервера в разном регистре и иногда в поле `reason`
 * (например, rate-limit: code = "429", reason = "RATE_LIMIT_EXCEEDED").
 * Здесь приводим их к одному ключу `api.errors`.
 * ***************************************************************************
 */
const REASON_CODES: Record<string, string> = {
    RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
    INVALID_TOKEN_SIGNATURE: "invalid_token_signature"
};

/**
 * Опции показа ошибки (toastError).
 */
interface ToastErrorOptions {
    /** Контекст для лога. */
    context?: string;
    /** Коды ошибок, которые обрабатывает вызывающий код. */
    codes?: string[];
    /** Текст тоста, если сработал `codes`. */
    text?: string;
    /** Текст-запасной, если код неизвестен. */
    fallback?: string;
    /** Подстановки для `%{name}%`-плейсхолдеров. */
    params?: Record<string, string | number>;
    /** Позиция тоста. */
    position?: string;
    /** Время показа тоста. */
    duration?: number;
    /** Только разобрать ошибку, тост не показывать. */
    silent?: boolean;
}

/**
 * Разобранная ошибка + флаг «вызывающий код обработал ошибку сам».
 */
interface ToastErrorResult extends ParsedError {
    /** true, если ошибка совпала с одним из `options.codes`. */
    isHandled: boolean;
}

/**
 * ***************************************************************************
 * toastError - единая точка показа ошибки пользователю.
 *
 * Разбирает ошибку (код/статус/текст) и показывает тост. Использование:
 * ```js
 * } catch (error) {
 *     const info = toastError(error, { context: "[app][messages][send]" });
 *     if (info.isAccessDenied) return;   // решение принимает вызывающий код
 * }
 * ```
 *
 * @param {unknown} error - Ошибка из catch.
 * @param {ToastErrorOptions} [options] - Опции показа.
 * @returns {ToastErrorResult} - Разобранная ошибка + флаги.
 * ***************************************************************************
 */
export function toastError(error: unknown, options: ToastErrorOptions = {}): ToastErrorResult {

    // Разбираем ошибку в единый вид
    const info: ToastErrorResult = { ...parseError(error), isHandled: false };

    // Контекст для логов
    const context = options.context || "[app]";

    // Логируем всегда: тост не заменяет лог
    Logger.error(`${context}: ошибка API`, error);

    // Флаги isAccessDenied/isRateLimit/isTimeout/isNetwork выставляет сам
    // parseError — здесь только сверяемся с ними, чтобы не было двух
    // разных определений «доступа нет» в разных местах кода.

    // Ошибку обработал вызывающий код: сверяемся с именем, кодом и причиной
    info.isHandled = Array.isArray(options.codes) &&
        options.codes.some(code => [info.name, info.code, info.reason].includes(String(code)));

    // Ответ не требуется — только разбор (например, для фоновых задач)
    if (options.silent) return info;

    // ==========================
    // Выбираем текст
    // ==========================
    // Приоритет: коды вызывающего → rate-limit → имя ошибки → текст сервера → fallback
    let text: string | null = (info.isHandled && options.text) || _localeForReason(info) || _localeForName(info) || null;

    // Имя ошибки есть, но текста в локали нет (например, ACCESS_DENIED_UNKNOWN):
    // показываем текст сервера, если он есть и это не технический мусор
    if (!text && info.message && !/^(ack timeout|disconnected|connection failed)/i.test(info.message)) {
        text = info.message;
    }

    // Совсем ничего не известно — универсальный fallback
    text = text || options.fallback || window._lc?.api?.errors?.server_error || "Ошибка сервера. Попробуйте позже";

    // ==========================
    // Подстановки
    // ==========================
    const params = options.params || {};
    for (const [key, value] of Object.entries(params)) {
        text = text.replaceAll(`%{${key}}%`, String(value));
    }

    // Показываем тост. duration больше для сетевых/таймаут ошибок,
    // чтобы пользователь успел прочитать и проверить соединение
    const duration = options.duration ?? (info.isTimeout || info.isNetwork ? 5000 : 3000);

    Toast.error(text, {
        position: options.position || "top-right",
        duration
    });

    return info;

}

/**
 * ***************************************************************************
 * Приватный: найти текст локализации по имени ошибки.
 * @param {ParsedError} info - Результат parseError.
 * @returns {string | null} - Текст или null, если имени нет в локализации.
 * ***************************************************************************
 */
function _localeForName(info: ParsedError): string | null {

    // Имени нет — искать нечего
    if (!info.name) return null;

    // Базовый вариант: имя в нижнем регистре (ACCESS_DENIED → access_denied)
    const key = String(info.name).toLowerCase();

    // Без подчёркиваний (MAX_FILES_EXCEEDED → maxfilesexceeded)
    return _localeError(key) || _localeError(key.replace(/_/g, ""));

}

/**
 * ***************************************************************************
 * Приватный: найти текст локализации по технической причине (`reason`).
 * Нужен для ошибок вроде RATE_LIMIT_EXCEEDED, где код — это "429".
 * @param {ParsedError} info - Результат parseError.
 * @returns {string | null} - Текст или null.
 * ***************************************************************************
 */
function _localeForReason(info: ParsedError): string | null {

    // Причины нет — искать нечего
    if (!info.reason) return null;

    const key = REASON_CODES[info.reason] || String(info.reason).toLowerCase();

    return _localeError(key);

}

/**
 * ***************************************************************************
 * Приватный: безопасно достать текст ошибки из локали по динамическому ключу.
 *
 * Дерево локализации типизировано фиксированными ключами, поэтому динамическое
 * чтение идёт через Reflect.get — без небезопасных приведений типов.
 * @param {string} key - Ключ в `api.errors`.
 * @returns {string | null} - Текст или null.
 * ***************************************************************************
 */
function _localeError(key: string): string | null {

    const errors: unknown = window._lc?.api?.errors;
    if (!errors || typeof errors !== "object") return null;

    const value: unknown = Reflect.get(errors, key);
    return typeof value === "string" ? value : null;

}
