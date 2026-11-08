/**
 * ***************************************************************************
 * Хелперы для работы со значением из catch-блока (тип unknown).
 * Выполняют runtime-сужение: не-объекты дают пустое значение,
 * ветки `.includes(...)` и сравнения с кодами ошибок остаются безопасными.
 * ***************************************************************************
 */

/**
 * ***************************************************************************
 * Сообщение ошибки из любого значения catch-блока.
 * @param error - Значение из catch.
 * @returns Сообщение ошибки или пустая строка.
 * ***************************************************************************
 */
export function getErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "message" in error && error.message) {
        return String(error.message);
    }
    return "";
}

/**
 * ***************************************************************************
 * Имя ошибки (например, "AbortError", "QuotaExceededError") из catch.
 * @param error - Значение из catch.
 * @returns Имя ошибки или undefined.
 * ***************************************************************************
 */
export function getErrorName(error: unknown): string | undefined {
    if (typeof error === "object" && error !== null && "name" in error && error.name) {
        return String(error.name);
    }
    return undefined;
}

/**
 * ***************************************************************************
 * HTTP-статус из любого значения catch-блока.
 * @param error - Значение из catch.
 * @returns Статус или undefined.
 * ***************************************************************************
 */
export function getErrorStatus(error: unknown): number | undefined {
    if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
        return error.status;
    }
    return undefined;
}

/**
 * ***************************************************************************
 * Строковый код ошибки из любого значения catch-блока
 * (например, "UPLOAD_ABORTED").
 * @param error - Значение из catch.
 * @returns Код ошибки или undefined.
 * ***************************************************************************
 */
export function getErrorCode(error: unknown): string | undefined {
    if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
        return error.code;
    }
    return undefined;
}
