/**
 * ***************************************************************************
 * ЛИМИТЫ ПЛАТФОРМЫ (клиент)
 *
 * Единственный источник чисел «сколько можно» — секция `limits` в настройках
 * сервера. Клиент получает её один раз при авторизации (POST /auth/check,
 * поле `server_data.limits`) и держит только в памяти: после перезагрузки
 * страницы лимиты приходят заново.
 *
 * Пока ответ не получен (старт в офлайне, старый сервер), getLimits()
 * возвращает null — тогда проверки размера, количества и длины текста
 * пропускаются на клиенте, а их ведёт сервер.
 *
 * Справочник типов файлов приходит в том же ответе (поле `file_types`),
 * поэтому applyServerLimits() заодно подменяет локальный справочник
 * (см. config/file_types.ts).
 *
 * Правило: своя копия лимитов на клиенте не хранится. Менять число — правка
 * настроек сервера, без пересборки клиента.
 * ***************************************************************************
 */

// Импортируем config
import { setFileTypes } from "./file_types.js";

/**
 * Является ли значение объектом-записью (не массив и не null):
 * guard для сетевых данных, пришедших как `unknown`.
 */
function isRecord(value: unknown): value is Record<string, unknown> {

    return typeof value === "object" && value !== null && !Array.isArray(value);

}

/**
 * Пределы платформы — структура поля `limits` ответа /auth/check
 * (зеркалит серверную секцию `limits` настроек сервера).
 */
export interface Limits {
    /** Файлы: загрузка вложений, документов, обложек и файлов облака. */
    files: {
        /** Максимальный размер одного файла, байт. */
        max_size_bytes: number;
        /** Максимум вложений в одном сообщении или комментарии. */
        max_files_per_message: number;
        /** Максимальная длина имени файла, символов. */
        max_file_name_length: number;
        /** Максимальный сериализованный размер метаданных файла, байт. */
        max_metadata_bytes: number;
    };
    /** Сообщения: текст и кнопки. */
    messages: {
        /** Максимум символов текста (считаются кодовые точки). */
        text_max_length: number;
        /** Максимум строк кнопок. */
        max_buttons: number;
        /** Максимум кнопок в одной строке. */
        max_buttons_per_row: number;
        /** Максимум символов текста кнопки. */
        max_button_text_length: number;
    };
    /** Стикеры: файл, изображение и пак. */
    stickers: {
        /** Максимальный размер файла стикера, байт. */
        max_size_bytes: number;
        /** Максимальная сторона изображения стикера, пиксели. */
        max_dimension: number;
        /** Максимум стикеров в одном паке. */
        max_per_pak: number;
        /** Максимальная длина названия пака, символов. */
        pak_name_max_length: number;
        /** Максимальная длина описания пака, символов. */
        pak_about_max_length: number;
    };
}

// Текущие лимиты. null — ответ авторизации ещё не получен (или в нём не было
// limits): в этом состоянии проверки ведёт сервер
let current: Limits | null = null;

/**
 * ***************************************************************************
 * Принять server_data ответа /auth/check: записать лимиты и подменить
 * справочник типов файлов серверным.
 *
 * Данные принимаются целиком или не принимаются вовсе: если поля `limits`
 * нет либо в нём не хватает группы/значения, текущее состояние сохраняется
 * (это ошибка данных, а не повод работать на полчеста чисел).
 *
 * @param serverData - Поле `server_data` ответа /auth/check (unknown, так
 *   как ответ приходит по сети).
 * @returns true, если лимиты записаны.
 * ***************************************************************************
 */
export function applyServerLimits(serverData: unknown): boolean {

    if (!isRecord(serverData)) return false;

    const raw = serverData.limits;
    if (!isRecord(raw)) return false;

    const parsed = parseLimits(raw);
    if (!parsed) return false;

    current = parsed;

    // Справочник типов файлов приходит в том же объекте: при мусоре
    // setFileTypes сам оставит предыдущие таблицы
    if (serverData.file_types !== undefined) setFileTypes(serverData.file_types);

    return true;

}

/**
 * ***************************************************************************
 * Текущие лимиты.
 * @returns Лимиты либо null, если ответ авторизации ещё не принят.
 * ***************************************************************************
 */
export function getLimits(): Limits | null {
    return current;
}

/**
 * ***************************************************************************
 * Собрать типизированные лимиты из пришедшего объекта.
 * @param raw - Объект `limits` из ответа (unknown, сетевые данные).
 * @returns Лимиты, либо null, если не хватает группы или значения.
 * ***************************************************************************
 */
function parseLimits(raw: Record<string, unknown>): Limits | null {

    const files = isRecord(raw.files) ? raw.files : null;
    const messages = isRecord(raw.messages) ? raw.messages : null;
    const stickers = isRecord(raw.stickers) ? raw.stickers : null;

    if (!files || !messages || !stickers) return null;

    const parsed: Limits = {
        files: {
            max_size_bytes: positiveInt(files.max_size_bytes) ?? 0,
            max_files_per_message: positiveInt(files.max_files_per_message) ?? 0,
            max_file_name_length: positiveInt(files.max_file_name_length) ?? 0,
            max_metadata_bytes: positiveInt(files.max_metadata_bytes) ?? 0
        },
        messages: {
            text_max_length: positiveInt(messages.text_max_length) ?? 0,
            max_buttons: positiveInt(messages.max_buttons) ?? 0,
            max_buttons_per_row: positiveInt(messages.max_buttons_per_row) ?? 0,
            max_button_text_length: positiveInt(messages.max_button_text_length) ?? 0
        },
        stickers: {
            max_size_bytes: positiveInt(stickers.max_size_bytes) ?? 0,
            max_dimension: positiveInt(stickers.max_dimension) ?? 0,
            max_per_pak: positiveInt(stickers.max_per_pak) ?? 0,
            pak_name_max_length: positiveInt(stickers.pak_name_max_length) ?? 0,
            pak_about_max_length: positiveInt(stickers.pak_about_max_length) ?? 0
        }
    };

    // Непригодное значение осталось нулём либо пустым списком — данные битые,
    // лимиты не принимаем
    const groups: ReadonlyArray<Record<string, unknown>> = [
        parsed.files, parsed.messages, parsed.stickers
    ];

    for (const group of groups) {
        for (const value of Object.values(group)) {
            if (typeof value === "number" && value < 1) return null;
            if (Array.isArray(value) && value.length === 0) return null;
        }
    }

    return parsed;

}

/**
 * ***************************************************************************
 * Взять положительное целое из пришедших данных.
 * @param value - Значение из ответа.
 * @returns Значение либо null, если тип или знак непригодны.
 * ***************************************************************************
 */
function positiveInt(value: unknown): number | null {
    return (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
        ? value
        : null;
}
