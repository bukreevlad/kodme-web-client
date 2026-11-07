// Импортируем utils
import { Logger } from "../logs/logger.js";

/**
 * Точность вывода даты, извлечённой из UUIDv7.
 */
export type Uuidv7Precision =
    | "seconds"
    | "milliseconds"
    | "iso"
    | "date-only"
    | "time-only"
    | "unix-seconds"
    | "unix-ms";

/**
 * ***************************************************************************
 * Извлекает дату из UUIDv7 с указанной точностью.
 * @param uuidStr - UUIDv7 в строковом формате.
 * @param precision - Точность (по умолчанию "milliseconds").
 * @returns Дата в указанном формате (строка или unix-timestamp) либо
 *   undefined, если UUID разобрать не удалось (ошибка логируется).
 * ***************************************************************************
 */
export function getDateFromUUIDv7(
    uuidStr: string,
    precision: Uuidv7Precision = "milliseconds"
): string | number | undefined {

    try {

        // Удаляем дефисы и берем первые 12 символов (первые 48 бит)
        const hexWithoutDashes = uuidStr.replace(/-/g, "");
        const hexTimestamp = hexWithoutDashes.substring(0, 12);

        // Конвертируем hex в decimal (делим на 2 для UUIDv7)
        const timestampMs = parseInt(hexTimestamp, 16);

        // Создаем Date объект
        const date = new Date(timestampMs);

        switch (precision) {
            case "seconds":
                // Только секунды (округление вниз)
                const seconds = Math.floor(timestampMs / 1000);
                return new Date(seconds * 1000).toISOString();

            case "milliseconds":
                // Полная точность с миллисекундами
                return date.toISOString();

            case "iso":
                // Стандартный ISO формат (то же, что и milliseconds)
                return date.toISOString();

            case "date-only":
                // Только дата
                return date.toISOString().split("T")[0];

            case "time-only":
                // Только время с секундами
                return (date.toISOString().split("T")[1] ?? "").split(".")[0] ?? "";

            case "unix-seconds":
                // Unix timestamp в секундах
                return Math.floor(timestampMs / 1000);

            case "unix-ms":
                // Unix timestamp в миллисекундах
                return timestampMs;

            default:
                return date.toISOString();
        }

    } catch (error) {
        Logger.error(error);
    }

}
