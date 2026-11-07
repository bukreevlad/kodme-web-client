/**
 * ***************************************************************************
 * ParseError - единый разбор ошибок API в предсказуемый вид.
 *
 * Зачем нужен модуль:
 * 1. Раньше код сравнивал `String(error.message).includes("Ошибка доступа")` —
 *    это ловило не тот текст, не тот язык и любое совпадение подстроки.
 * 2. Сервер отдаёт код ошибки (`ACCESS_DENIED`, `RATE_LIMIT_EXCEEDED`, ...) —
 *    но транспорт его терял. Теперь ошибка с WS приходит с `code`/`status`,
 *    а HTTP-ошибка — с `status` и `details` (тело ответа).
 * 3. Разные источники ошибок (WS, fetch, таймаут, обрыв сокета) приводим
 *    к одному объекту, чтобы логика показа тоста была одна.
 *
 * Форма результата описана интерфейсом ParsedError.
 * ***************************************************************************
 */

/**
 * Возможные поля разбираемой ошибки (ловим «на веру» то, что клал транспорт).
 */
interface ErrorLike {
    /** Текст ошибки. */
    message?: unknown;
    /** Код ошибки. */
    code?: unknown;
    /** Техническая причина. */
    reason?: unknown;
    /** HTTP/WS-статус. */
    status?: unknown;
    /** Тело ответа / детали сервера. */
    details?: unknown;
}

/**
 * Результат разбора ошибки — предсказуемый вид для показа тостов.
 */
export interface ParsedError {
    /** Текст ошибки от сервера. */
    message: string | null;
    /** Имя ошибки (ACCESS_DENIED, INVITE_INVALID...), вытащенное из «ИМЯ :: код». */
    name: string | null;
    /** Код ошибки (строка: "ACCESS_DENIED" либо "429"). */
    code: string | null;
    /** HTTP/WS-статус (429 и т.п.). */
    status: number | null;
    /** Техническая причина (RATE_LIMIT_EXCEEDED). */
    reason: string | null;
    /** Дополнительные данные сервера. */
    details: unknown;
    /** Истёк ли таймаут ожидания ответа. */
    isTimeout: boolean;
    /** Обрыв сокета / отсутствие сети. */
    isNetwork: boolean;
    /** Отказ в доступе (бан, закрытый канал и т.п.). */
    isAccessDenied: boolean;
    /** Превышен лимит запросов. */
    isRateLimit: boolean;
}

// Коды, по которым сервер кодирует HTTP-статус прямо в code ("429")
const STATUS_CODES = new Set(["400", "401", "403", "404", "408", "409", "413", "429", "500", "502", "503"]);

// Маркеры таймаута/обрыва в тексте ошибки сокета (см. config/socket.js)
const TIMEOUT_MARKERS = ["ack timeout", "connection timeout", "heartbeat timeout"];
const NETWORK_MARKERS = ["disconnected", "connection failed", "failed to fetch", "networkerror", "load failed"];

/**
 * ***************************************************************************
 * Привести любую ошибку к структурированному виду.
 * @param {unknown} error - Ошибка из catch.
 * @returns {ParsedError} - Структурированный вид ошибки.
 * ***************************************************************************
 */
export function parseError(error: unknown): ParsedError {

    // Нормализованный результат по умолчанию (флаги добавит _withFlags)
    const result: Omit<ParsedError, "isAccessDenied" | "isRateLimit"> = {
        message: null,
        name: null,
        code: null,
        status: null,
        reason: null,
        details: null,
        isTimeout: false,
        isNetwork: false
    };

    // Нечего разбирать
    if (error === null || error === undefined) return _withFlags(result);

    // ==========================
    // 1. Error из WebSocket или HTTP
    // ==========================
    // После правки транспорта у ошибки есть code/reason/status/details.
    // Error — тоже объект, поэтому достаточно проверки на непустой объект.
    if (_isErrorLike(error)) {

        const details = _isErrorLike(error.details) ? error.details : null;

        // Кандидаты текста ошибки, по убыванию полезности.
        // Для HTTP важнее `details.message`: fetch_handler оборачивает его в
        // «Ошибка 400: <текст сервера>», и имя ошибки осталось бы спрятано.
        const candidates = _unique([
            _cleanMessage(details?.message),
            _stripHttpPrefix(_cleanMessage(error.message)),
            _cleanMessage(error.message)
        ]);

        // Ищем текст, из которого можно вытащить имя ошибки вида «ИМЯ :: код» —
        // сервер формирует сообщение ошибки именно в таком формате.
        let parsed: { name: string | null; code: string | null; message: string | null } = { name: null, code: null, message: null };
        let matchedIndex = -1;
        for (let index = 0; index < candidates.length; index++) {
            const attempt = _splitServerMessage(candidates[index] ?? "");
            if (attempt.name) {
                parsed = attempt;
                matchedIndex = index;
                break;
            }
        }

        // Имя ошибки
        result.name = parsed.name;

        // Текст для показа пользователю:
        // - если весь текст оказался шаблоном «ИМЯ :: код», показывать нечего
        //   (покажем текст из локализации по имени ошибки);
        // - если в тексте осталась «человеческая» часть — берём её;
        // - если имя не разобралось — берём первый непустой кандидат.
        if (matchedIndex === -1) {
            result.message = candidates[0] ?? null;
        } else if (parsed.message) {
            result.message = parsed.message;
        } else if (matchedIndex + 1 < candidates.length) {
            result.message = candidates[matchedIndex + 1] ?? null;
        } else {
            result.message = null;
        }

        // Код: error.code → details.code → код из текста
        result.code = _cleanToken(error.code)
            || (details ? _cleanToken(details.code) : null)
            || parsed.code;

        // Причина: error.reason → details.reason
        result.reason = _cleanToken(error.reason) || (details ? _cleanToken(details.reason) : null);

        // Статус: error.status → details.status → код-"429"-как-статус
        result.status = _toStatus(error.status) ?? (details ? _toStatus(details.status) : null);
        if (result.status === null && result.code && STATUS_CODES.has(String(result.code))) {
            result.status = Number(result.code);
        }

        // Детали
        result.details = error.details ?? null;

        // Служебные флаги по тексту (WS не отдаёт код для таймаута/обрыва)
        const text = `${error.message ?? ""}`.toLowerCase();
        result.isTimeout = TIMEOUT_MARKERS.some(marker => text.includes(marker));
        result.isNetwork = NETWORK_MARKERS.some(marker => text.includes(marker));

        return _withFlags(result);

    }

    // ==========================
    // 2. Строка ошибки
    // ==========================
    // Старый формат: сервер/сокет отдавал просто строку
    result.message = _cleanMessage(String(error));

    // Строковые ответы сервера тоже бывают вида "ACCESS_DENIED :: 108800"
    const parsed = _splitServerMessage(result.message);
    result.name = parsed.name;
    result.code = parsed.code;
    if (parsed.message) result.message = parsed.message;

    const text = `${result.message ?? ""}`.toLowerCase();
    result.isTimeout = TIMEOUT_MARKERS.some(marker => text.includes(marker));
    result.isNetwork = NETWORK_MARKERS.some(marker => text.includes(marker));

    return _withFlags(result);

}

/**
 * ***************************************************************************
 * Добавить «человеческие» флаги, которые вызывающий код проверяет чаще всего.
 *
 * Раньше каждое место писало своё `error.code === "ACCESS_DENIED" || error.code === 403`,
 * и эти проверки расходились между собой. Теперь достаточно одного флага.
 * @param {Omit<ParsedError, "isAccessDenied" | "isRateLimit">} result - Результат разбора.
 * @returns {ParsedError} - Тот же объект с добавленными флагами.
 * ***************************************************************************
 */
function _withFlags(result: Omit<ParsedError, "isAccessDenied" | "isRateLimit">): ParsedError {

    // Отказ в доступе: по имени ошибки или по HTTP-статусу
    const isAccessDenied = result.name === "ACCESS_DENIED" || result.status === 403;

    // Превышение лимита запросов: по статусу или по технической причине
    const isRateLimit = result.status === 429
        || result.reason === "RATE_LIMIT_EXCEEDED"
        || result.code === "429";

    return { ...result, isAccessDenied, isRateLimit };

}

/**
 * ***************************************************************************
 * Проверить, похож ли разбираемый объект на ошибку с полями транспорта.
 * @param {unknown} value - Разбираемое значение.
 * @returns {value is ErrorLike} - Непустой объект (в т.ч. экземпляр Error).
 * ***************************************************************************
 */
function _isErrorLike(value: unknown): value is ErrorLike {
    return typeof value === "object" && value !== null;
}

/**
 * ***************************************************************************
 * Убрать пустые значения и дубликаты, сохранив порядок.
 *
 * Зачем: для WS-ошибки все три кандидата совпадают (`error.message` не менялся
 * `_stripHttpPrefix`), и «запасной» текст оказался бы тем же самым шаблоном
 * «ИМЯ :: код» вместо человеческого сообщения.
 * @param {Array<string | null>} values - Исходные значения.
 * @returns {string[]} - Непустые уникальные значения.
 * ***************************************************************************
 */
function _unique(values: Array<string | null>): string[] {

    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        if (!value || seen.has(value)) continue;
        seen.add(value);
        result.push(value);
    }

    return result;

}

/**
 * ***************************************************************************
 * Убрать обёртку HTTP-ошибки вида «Ошибка 404: <текст сервера>».
 *
 * `fetch_handler` формирует сообщение именно так, добавляя статус и текст
 * сервера в одну строку. Без снятия префикса имя ошибки из текста не читалось:
 * /^([A-Za-z0-9_-]+)\s*::\s*...$/ требовал начало строки.
 * @param {string | null} message - Сообщение ошибки.
 * @returns {string | null} - Сообщение без технического префикса.
 * ***************************************************************************
 */
function _stripHttpPrefix(message: string | null): string | null {

    if (!message) return null;

    // Префикс строит fetch_handler: «Ошибка 404: ...»
    const stripped = String(message).replace(/^\s*(?:Ошибка|Error)\s+\d{3}\s*:\s*/i, "");

    return stripped ? stripped : message;

}

/**
 * ***************************************************************************
 * Разобрать текст ошибки вида `ИМЯ :: код` (формат AppError на сервере).
 *
 * Зачем: сервер кладёт имя ошибки в message, а числовой код — отдельно.
 * Без разбора `info.message` был равен «ACCESS_DENIED :: 108800», и
 * сравнение с «ACCESS_DENIED» никогда не срабатывало.
 * @param {string | null} message - Текст ошибки.
 * @returns {{name: string | null, code: string | null, message: string | null}} - Разобранные части.
 * ***************************************************************************
 */
function _splitServerMessage(message: string | null): { name: string | null; code: string | null; message: string | null } {

    // Нет сообщения — разбирать нечего
    if (!message) return { name: null, code: null, message: null };

    // Формат сервера: `ИМЯ :: код`. Если его нет — считаем текст обычным сообщением
    const match = /^([A-Za-z0-9_-]+)\s*::\s*([A-Za-z0-9_-]+)$/.exec(message);
    if (!match) return { name: null, code: null, message };

    return {
        name: match[1] ?? null,
        code: match[2] ?? null,
        message: null
    };

}

/**
 * ***************************************************************************
 * Привести ошибку к строке-сообщению (без служебных символов).
 * @param {unknown} message - Исходное сообщение.
 * @returns {string | null} - Очищенный текст или null.
 * ***************************************************************************
 */
function _cleanMessage(message: unknown): string | null {
    if (message === null || message === undefined) return null;
    const text = String(message).trim();
    return text ? text : null;
}

/**
 * ***************************************************************************
 * Привести значение к «коду» (без пробелов, до 64 символов).
 * @param {unknown} value - Исходное значение.
 * @returns {string | null} - Код или null.
 * ***************************************************************************
 */
function _cleanToken(value: unknown): string | null {
    if (value === null || value === undefined || value === false) return null;
    const text = String(value).trim();
    if (!text || text.length > 64) return null;

    // Коды состоят из латиницы, цифр и «_»
    return /^[A-Za-z0-9_-]+$/.test(text) ? text : null;
}

/**
 * ***************************************************************************
 * Привести значение к числовому HTTP-статусу.
 * @param {unknown} value - Исходное значение.
 * @returns {number | null} - Статус или null.
 * ***************************************************************************
 */
function _toStatus(value: unknown): number | null {
    if (value === null || value === undefined || value === false) return null;
    const status = Number(value);
    return (Number.isInteger(status) && status >= 100 && status <= 599) ? status : null;
}
