// Импортируем utils
import { getErrorMessage } from "./error_util.js";

/** Коды ошибок сервера «канала нет / доступ закрыт». */
const UNAVAILABLE_CODES = [
    "CHANNEL_INFO_FAILED",
    "CHANNEL_NOT_FOUND",
    "ENTITY_NOT_FOUND",
    "ACCESS_DENIED"
];

/**
 * ***************************************************************************
 * Признак того, что сервер отказал в данных канала по причине его
 * отсутствия или закрытого доступа (канал удалён, пользователь выкинут).
 *
 * Используется ленивым обнаружением: канал, чьё событие удаления потерялось
 * (например, при очень долгом оффлайне), вычищается из локальных хранилищ
 * при первой неудачной попытке обратиться к нему.
 * @param error - Значение из catch.
 * @returns true, если канал недоступен (а не временная сетевая ошибка).
 * ***************************************************************************
 */
export function isChannelUnavailable(error: unknown): boolean {

    const message = getErrorMessage(error);
    return UNAVAILABLE_CODES.some((code) => message.includes(code));

}
