// Импортируем utils
import { getLimits } from "../../config/limits.js";

// Импортируем справочник типов файлов
// (namespace-импорт: в модуле уже есть локальные обёртки getExtension /
// resolveMimeType / isMimeConsistent — прямые имена столкнулись бы с ними)
import * as FileTypes from "../../config/file_types.js";
import { t } from "../i18n/index.js";
import { I18n } from "../i18n/index.js";

/**
 * ***************************************************************************
 * FileValidator - проверка файла ДО загрузки на сервер.
 *
 * Зачем нужен модуль:
 * - Сервер проверяет расширение по white-листу (`utils/validation/
 *   validate_extension.util.js`) и отдаёт `INVALID_EXTENSION`. Но проверка
 *   происходила уже ПОСЛЕ того, как файл выбрали, метадату декодировали
 *   (canvas-превью для видео!) и получили presigned URL. Пользователь ждал
 *   несколько секунд и получал отказ.
 * - Размер файла сервер тоже не проверял: файл уходил в S3 напрямую по
 *   presigned URL, и слишком большой просто падал на загрузке. Теперь сервер
 *   проверяет `INVALID_FILE_SIZE` до выдачи ссылки.
 * - Расширение и mime-тип могут противоречить друг другу (переименованный
 *   `.jpg`, который на самом деле `.exe`) — это стоит сказать заранее.
 *
 * Лимит размера берётся из `getLimits()` (config/limits.ts): пока ответ
 * авторизации не принят, проверка размера пропускается — её ведёт сервер.
 *
 * Проверки дешёвые и синхронные: они выполняются до генерации метадаты.
 *
 * Про справочник типов файлов. Раньше этот модуль держал собственные таблицы
 * `MIME_TO_EXTENSIONS` и `EXTENSION_TO_MIME` — то есть знание о типах файлов
 * лежало в трёх местах на клиенте и в трёх на сервере, и все они разошлись.
 * Теперь всё это в `config/file_types.js`, а сервер присылает свой вариант
 * справочника, пришедшего при авторизации (см. `config/limits.js`).
 *
 * Форма результата: `{ isValid, code, params }`, где `code` — ключ локали
 * (`forms.messages.toasts.*`).
 * ***************************************************************************
 */

/**
 * Коды ошибок валидации файла — ключи локали `forms.messages.toasts.*`.
 */
export type FileValidationCode = "invalid_extension" | "file_too_large" | "invalid_mime";

/**
 * Параметры ошибки валидации файла (подстановка в текст тоста).
 */
export interface FileValidationParams {
    name?: string;
    size?: string;
}

/**
 * Результат полной проверки файла: `isValid: true` всегда с `code: null`,
 * `isValid: false` — с кодом ошибки или без него (молчаливый фильтр).
 */
export type FileValidationResult =
    | { isValid: true; code: null; params: Record<string, never> }
    | { isValid: false; code: FileValidationCode | null; params: FileValidationParams };

/**
 * Ошибка из filterFiles: код + параметры для тоста.
 */
export interface FileValidationError {
    code: FileValidationCode | null;
    params: FileValidationParams;
}

/**
 * Результат filterFiles: допустимые файлы + собранные ошибки.
 */
export interface FilterFilesResult {
    files: File[];
    errors: FileValidationError[];
}

/**
 * Опции проверки файла.
 */
export interface FileValidationOptions {
    /** Максимум байт (по умолчанию — общий лимит с сервера). */
    maxSize?: number;
}

/**
 * ***************************************************************************
 * Человекочитаемый список расширений для атрибута `accept` диалога выбора.
 *
 * `accept` — только UX: диалог в системе подсвечивает подходящие файлы. Реальную
 * проверку всё равно делает `validateFile` (через drag&drop, вставку из буфера
 * и «выбрать всё» в диалоге `accept` обходится тривиально).
 * @returns Список расширений через запятую.
 * ***************************************************************************
 */
export function getAcceptExtensions(): string {

    return FileTypes.getAllowedExtensions().join(",");

}

/**
 * ***************************************************************************
 * Получить расширение файла в нижнем регистре (с точкой).
 * @param file - Файл.
 * @returns Расширение или пустая строка.
 * ***************************************************************************
 */
export function getExtension(file: File): string {

    return FileTypes.getExtension(file);

}

/**
 * ***************************************************************************
 * Определить MIME-тип файла для отправки на сервер.
 *
 * Порядок: `File.type` браузера -> резервный MIME из справочника для
 * расширения -> `application/octet-stream`. Сервер требует непустой MIME
 * (`MIME_TYPE_REQUIRED`), поэтому последний вариант — тоже лучше, чем
 * пустая строка.
 *
 * Резервный MIME раньше держался в собственной таблице `EXTENSION_TO_MIME`
 * этого файла. Теперь он берётся из того же справочника, по которому сервер
 * проверяет, — то есть клиент подставляет ровно то, что сервер примет.
 *
 * @param file - Файл.
 * @returns MIME-тип в нижнем регистре.
 * ***************************************************************************
 */
export function resolveMimeType(file: File): string {

    return FileTypes.resolveMimeType(file);

}

/**
 * ***************************************************************************
 * Проверить, что расширение файла входит в white-лист платформы.
 * @param file - Файл.
 * @returns true, если расширение допустимо.
 * ***************************************************************************
 */
export function hasAllowedExtension(file: File): boolean {

    return FileTypes.isAllowedExtension(file);

}

/**
 * ***************************************************************************
 * Проверить размер файла.
 * @param file - Файл.
 * @param options - Опции.
 * @param options.maxSize - Максимум байт (по умолчанию общий лимит с сервера).
 * @returns true, если размер допустим.
 * ***************************************************************************
 */
export function isSizeAllowed(file: File, options: FileValidationOptions = {}): boolean {

    const maxSize = options.maxSize ?? getLimits()?.files.max_size_bytes;

    // Лимит неизвестен (ответ авторизации ещё не принят) — проверку ведёт
    // сервер: подписываемая политика не даст залить больше разрешённого
    if (maxSize === undefined) return true;

    return Number(file?.size || 0) <= maxSize;

}

/**
 * ***************************************************************************
 * Проверить, что mime-тип согласован с расширением.
 *
 * Если браузер не знает тип файла (пусто или octet-stream), проверка
 * пропускается: иначе мы отклоняли бы нормальные файлы вроде `.fb2`.
 * @param file - Файл.
 * @returns true, если явного противоречия нет.
 * ***************************************************************************
 */
export function isMimeConsistent(file: File): boolean {

    return FileTypes.isMimeConsistent(file);

}

/**
 * ***************************************************************************
 * Полная проверка файла перед вложением в сообщение.
 * @param file - Файл.
 * @param options - Опции.
 * @param options.maxSize - Максимум байт (по умолчанию общий лимит с сервера).
 * @returns Результат проверки.
 * ***************************************************************************
 */
export function validateFile(file: File, options: FileValidationOptions = {}): FileValidationResult {

    // Файла нет — проверять нечего, результат «невалиден» без кода,
    // чтобы вызывающий код отфильтровал файл молча
    if (!file) return { isValid: false, code: null, params: {} };

    const name = file.name || t("api.errors.file_fallback_name");

    // Единый лимит размера: явная опция вызывающего либо серверный лимит
    const maxSize = options.maxSize ?? getLimits()?.files.max_size_bytes;

    // 1. Расширение в white-листе платформы
    if (!hasAllowedExtension(file)) {
        return { isValid: false, code: "invalid_extension", params: { name } };
    }

    // 2. Размер (сервер тоже отклоняет — INVALID_FILE_SIZE, но до проверки
    //    мы не успеваем декодировать метадату, а это секунды на видео)
    if (maxSize !== undefined && !isSizeAllowed(file, { maxSize })) {
        return {
            isValid: false,
            code: "file_too_large",
            params: { name, size: formatBytes(maxSize) }
        };
    }

    // 3. Согласованность mime и расширения
    if (!isMimeConsistent(file)) {
        return { isValid: false, code: "invalid_mime", params: { name } };
    }

    return { isValid: true, code: null, params: {} };

}

/**
 * ***************************************************************************
 * Отфильтровать список файлов, вернув только допустимые.
 *
 * Ошибки собираются по ключам кода, чтобы вызывающий код показал по одному
 * тосту на тип проблемы, а не по одному на каждый битый файл (при выборе
 * 20 файлов пользователь иначе получил бы 20 всплывающих окон).
 * @param files - Файлы из input/drop.
 * @param options - Опции (см. validateFile).
 * @returns Результат: допустимые файлы и собранные ошибки.
 * ***************************************************************************
 */
export function filterFiles(files: Iterable<File> | null | undefined, options: FileValidationOptions = {}): FilterFilesResult {

    // Собираем результат
    const result: FilterFilesResult = { files: [], errors: [] };

    // Приводим к массиву (input.files — FileList, drop — DataTransfer.items)
    const list = Array.from(files || []);

    for (const file of list) {
        const check = validateFile(file, options);
        if (check.isValid) {
            result.files.push(file);
        } else {
            result.errors.push({ code: check.code, params: check.params });
        }
    }

    return result;

}

/**
 * ***************************************************************************
 * Привести размер в байтах к читаемому виду (локальный формат модуля —
 * отличается от общей утилиты `format_bytes`, формат тоста менять нельзя).
 * @param bytes - Количество байт.
 * @returns Например «100 МБ».
 * ***************************************************************************
 */
function formatBytes(bytes: number): string {

    // Юниты — из локали (заглавные: «б»→«Б»), формат тоста не меняется
    const units = I18n.tree.utils.format_bites.sizes.slice(0, 5).map((unit) => unit.toUpperCase());
    if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${units[0]}`;

    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);

    return `${Math.round(value * 10) / 10} ${units[index]}`;

}
