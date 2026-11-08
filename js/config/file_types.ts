/**
 * ***************************************************************************
 * ЕДИНЫЙ СПРАВОЧНИК ТИПОВ ФАЙЛОВ (клиент)
 *
 * Откуда данные. Справочник живёт только на сервере; клиент получает его при
 * авторизации (POST /auth/check, поле `server_data.file_types`) и держит в
 * памяти — `setFileTypes()` подменяет таблицы целиком. Пока ответ не принят,
 * таблицы пустые, и проверки расширения пропускаются — их ведёт сервер.
 *
 * Логика сборки таблиц повторяет серверную: два приложения, общей сборки
 * нет, но данные приходят из одного места.
 *  */

/**
 * Вход для функций, принимающих «что-нибудь файлное»: имя файла строкой,
 * объект с `name`/`type` (File, Blob, их обёртки), пустое значение.
 */
export type FileInput = string | { name?: string; type?: string } | null | undefined;

/**
 * Запись справочника для одного расширения: допустимые MIME
 * (`null` = не сверяем, формат браузер отдаёт неоднозначно) и MIME
 * по умолчанию (`null`, когда резервного типа нет).
 */
export type FileTypeEntry = {

    /** Допустимые MIME расширения или null, если сверка не определена. */
    mimes: string[] | null;

    /** Что подставить, когда `File.type` пуст. */
    default: string | null;

};

/**
 * Справочник типов: категория (`kind`) -> расширение -> запись.
 */
export type FileTypesCatalog = Record<string, Record<string, FileTypeEntry>>;

/**
 * Плоская запись справочника, разрешённая по расширению.
 */
export type FileTypeExtension = {

    /** Категория файла (`image`, `video`, `audio`, ...). */
    kind: string;

    /** Допустимые MIME расширения или null, если сверка не определена. */
    mimes: string[] | null;

    /** Резервный MIME, когда `File.type` пуст. */
    default: string | null;

};

/**
 * Объект-источник для определения категории: приоритет у расширения
 * (по `file`/`extension`/`file_name`), затем MIME.
 */
export type FileKindQuery = {

    /** Имя файла, File или Blob. */
    file?: FileInput;

    /** Расширение с точкой. */
    extension?: string;

    /** Имя файла (поле запроса/метаданных). */
    file_name?: FileInput;

    /** MIME-тип. */
    mime?: string;

};

/**
 * Плоские таблицы, построенные из справочника (см. `_buildTables`).
 */
type FileTables = {

    /** Категории в порядке объявления справочника. */
    kinds: string[];

    /** Расширение -> плоская запись. */
    extensionTypes: Record<string, FileTypeExtension>;

    /** Расширение -> категория. */
    extensionKinds: Record<string, string>;

    /** Категория -> её MIME. */
    kindMimes: Record<string, string[]>;

    /** Категория -> первый резервный MIME. */
    kindDefaultMimes: Record<string, string | null>;

    /** Категория -> её расширения. */
    kindExtensions: Record<string, string[]>;

    /** MIME -> расширения, в которых он допустим. */
    mimeExtensions: Record<string, string[]>;

    /** Белый список расширений плоским списком. */
    allowedExtensions: string[];

};

/**
 * Является ли значение объектом-записью (не массив и не null):
 * guard для сетевых данных, пришедших как `unknown`.
 */
function isRecord(value: unknown): value is Record<string, unknown> {

    return typeof value === "object" && value !== null && !Array.isArray(value);

}

/**
 * Является ли значение массивом строк: guard для полей `mimes`/`default`,
 * чтобы не тянуть `any` из проверки `Array.isArray` в таблицы.
 */
function isStringArray(value: unknown): value is string[] {

    if (!Array.isArray(value)) return false;

    return value.every((item: unknown) => typeof item === "string");

}

/**
 * Привести сырую запись справочника к типизированной форме.
 *
 * Lenient-поведение сохранено: не-объект и мусорные поля превращаются в
 * `null`, а не в исключение — обрыв сети или старый билд сервера не должны
 * оставлять клиент без проверки расширений.
 *
 * @param description - Сырая запись из сети (или мусор).
 * @returns Типизированная запись `{ mimes, default }`.
 */
function toEntry(description: unknown): FileTypeEntry {

    if (!isRecord(description)) return { mimes: null, default: null };

    const mimes = isStringArray(description.mimes) ? description.mimes : null;
    const fallback = typeof description.default === "string" && description.default
        ? description.default
        : null;

    return { mimes, default: fallback };

}

/**
 * Привести сырой справочник к типизированной форме (нормализация до
 * построения таблиц: категории-не-объекты пропускаются, мусорные записи
 * вырождаются в `null`-поля).
 *
 * @param raw - Сырой справочник из сети.
 * @returns Типизированный справочник.
 */
function toCatalog(raw: Record<string, unknown>): FileTypesCatalog {

    const catalog: FileTypesCatalog = {};

    for (const [kind, group] of Object.entries(raw)) {

        // Категория-не-объект не может нести расширения — пропускаем
        if (!isRecord(group)) continue;

        const extensions: Record<string, FileTypeEntry> = {};

        for (const [extension, description] of Object.entries(group)) {
            extensions[extension] = toEntry(description);
        }

        catalog[kind] = extensions;

    }

    return catalog;

}


// ***************************************************************************
// ТАБЛИЦЫ
// ***************************************************************************

/**
 * ***************************************************************************
 * Развернуть справочник в плоские таблицы.
 *
 * Один MIME не должен принадлежать двум категориям: иначе `isKind()` даёт
 * неоднозначный ответ. При коллизии бросаем исключение — это ошибка данных,
 * и лучше упасть громко при первом ответе сервера, чем тихо классифицировать
 * вложения неправильно весь день.
 *
 * @param fileTypes - Справочник kind -> расширение -> описание.
 * @returns Плоские таблицы.
 * ***************************************************************************
 */
function _buildTables(fileTypes: FileTypesCatalog): FileTables {

    const kinds = Object.keys(fileTypes);

    const extensionTypes: Record<string, FileTypeExtension> = {};   // ".jpg" -> { kind, mimes, default }
    const extensionKinds: Record<string, string> = {};              // ".jpg" -> "image"
    const kindMimes: Record<string, string[]> = {};                 // "image" -> ["image/jpeg", ...]
    const kindDefaultMimes: Record<string, string | null> = {};     // "image" -> "image/jpeg"
    const kindExtensions: Record<string, string[]> = {};            // "image" -> [".jpg", ...]
    const mimeExtensions: Record<string, string[]> = {};            // "image/jpeg" -> [".jpg", ".jpeg"]

    for (const kind of kinds) {

        const group = fileTypes[kind];
        if (!group) continue;

        kindMimes[kind] = [];
        kindDefaultMimes[kind] = null;
        kindExtensions[kind] = [];

        for (const [extension, description] of Object.entries(group)) {

            if (extensionTypes[extension]) {
                throw new Error(`FILE_TYPES: расширение ${extension} описано дважды`);
            }

            const mimes = description.mimes;

            extensionTypes[extension] = {
                kind: kind,
                mimes: mimes,
                default: description.default
            };

            extensionKinds[extension] = kind;
            kindExtensions[kind].push(extension);

            if (!kindDefaultMimes[kind] && description.default) {
                kindDefaultMimes[kind] = description.default;
            }

            if (!mimes) continue;

            for (const mime of mimes) {

                const existing = mimeExtensions[mime];

                if (existing && !existing.some(item => extensionTypes[item]?.kind === kind)) {
                    throw new Error(`FILE_TYPES: mime ${mime} встречается в категориях ${kind} и ${extensionTypes[existing[0] ?? ""]?.kind}`);
                }

                if (!mimeExtensions[mime]) mimeExtensions[mime] = [];
                mimeExtensions[mime].push(extension);

                if (!kindMimes[kind].includes(mime)) kindMimes[kind].push(mime);

            }

        }

    }

    return {
        kinds: kinds,
        extensionTypes: extensionTypes,
        extensionKinds: extensionKinds,
        kindMimes: kindMimes,
        kindDefaultMimes: kindDefaultMimes,
        kindExtensions: kindExtensions,
        mimeExtensions: mimeExtensions,
        allowedExtensions: Object.keys(extensionTypes)
    };

}

// Текущее состояние. Пусто до принятия ответа /auth/check, дальше меняется
// целиком при `setFileTypes`
let TABLES: FileTables = _buildTables({});

// Текущий справочник целиком — отдаём в `getFileTypes()` и для отладки
let CURRENT_FILE_TYPES: FileTypesCatalog = {};

// MIME, которые браузер отдаёт обобщённо. В справочник они не входят, поэтому
// `isKind()` по такому MIME вернёт false — это правильно: тип по ним не узнать.
const GENERIC_MIMES = [
    "",
    "application/octet-stream",
    "binary/octet-stream",
    "application/download",
    "application/x-download",
    "multipart/form-data"
];

/**
 * ***************************************************************************
 * Подменить справочник на серверный.
 *
 * Откуда. Сервер отдаёт `file_types` в ответе на авторизацию
 * (POST /auth/check). Своей копии таблиц у клиента нет — поэтому менять
 * белый список расширений на сервере не нужно синхронно править здесь.
 *
 * Что делаем при мусоре. Ничего: оставляем предыдущие таблицы — обрыв сети
 * или старый билд сервера не должны оставлять клиент без проверки
 * расширений.
 *
 * @param fileTypes - Справочник из `server_data.file_types` (сетевые данные
 *   приходят как `unknown`).
 * @returns true, если справочник принят и таблицы перестроены.
 * ***************************************************************************
 */
export function setFileTypes(fileTypes: unknown): boolean {

    // Пришли мусор или ничего — оставляем текущие таблицы
    if (!isRecord(fileTypes)) return false;

    // Хотя бы одна категория с хотя бы одним расширением
    const hasData = Object.values(fileTypes)
        .some(group => isRecord(group) && Object.keys(group).length > 0);

    if (!hasData) return false;

    try {

        // Нормализуем до типизированной формы: таблицы и текущий справочник
        // меняются целиком и согласованно
        const catalog = toCatalog(fileTypes);

        TABLES = _buildTables(catalog);
        CURRENT_FILE_TYPES = catalog;

        return true;

    } catch (error) {

        // Коллизия или дубль в серверных данных — остаёмся на прошлых
        // таблицах, чтобы не классифицировать вложения наугад
        return false;

    }

}

// ***************************************************************************
// ХЕЛПЕРЫ
// ***************************************************************************

/**
 * ***************************************************************************
 * Привести MIME к каноническому виду: нижний регистр, без пробелов.
 *
 * @param mime - MIME-тип.
 * @returns Нормализованный MIME или пустая строка.
 * ***************************************************************************
 */
export function normalizeMime(mime?: string): string {

    return String(mime ?? "").trim().toLowerCase();

}

/**
 * ***************************************************************************
 * Получить расширение файла в нижнем регистре, с точкой.
 *
 * @param file - Имя файла, Blob или объект File.
 * @returns Расширение с точкой или пустая строка.
 * ***************************************************************************
 */
export function getExtension(file?: FileInput): string {

    // Принимаем и File, и строку: вызывающие места по-разному держат в руках
    const name = typeof file === "string" ? file : String(file?.name || "");

    // Точка в имени (v1.2.pdf) — берём часть после последней точки
    const dotIndex = name.lastIndexOf(".");

    return dotIndex > -1 ? name.slice(dotIndex).toLowerCase() : "";

}

/**
 * ***************************************************************************
 * Разрешение расширения в запись справочника.
 *
 * @param extension - Расширение с точкой (регистр не важен).
 * @returns `{ kind, mimes, default }` или null.
 * ***************************************************************************
 */
export function getExtensionType(extension?: string): FileTypeExtension | null {

    if (!extension || typeof extension !== "string") return null;

    return TABLES.extensionTypes[String(extension).trim().toLowerCase()] || null;

}

/**
 * ***************************************************************************
 * Разрешение файла в запись справочника.
 *
 * @param file - Имя файла, Blob или объект File.
 * @returns `{ kind, mimes, default }` или null.
 * ***************************************************************************
 */
export function getFileType(file?: FileInput): FileTypeExtension | null {

    return getExtensionType(getExtension(file));

}

/**
 * ***************************************************************************
 * Проверить, что расширение входит в белый список платформы.
 *
 * @param file - Имя файла, Blob или объект File.
 * @returns true, если расширение допустимо.
 * ***************************************************************************
 */
export function isAllowedExtension(file?: FileInput): boolean {

    // Справочник ещё не принят (ответ /auth/check не получен) — белого
    // списка нет, проверку расширения ведёт сервер
    if (TABLES.allowedExtensions.length === 0) return true;

    return getFileType(file) !== null;

}

/**
 * ***************************************************************************
 * Белый список расширений, плоским списком.
 * @returns Расширения с точкой.
 * ***************************************************************************
 */
export function getAllowedExtensions(): string[] {

    return [...TABLES.allowedExtensions];

}

/**
 * ***************************************************************************
 * Определить категорию файла по расширению.
 *
 * @param file - Имя файла, Blob или объект File.
 * @returns Категория или null.
 * ***************************************************************************
 */
export function getKindByExtension(file?: FileInput): string | null {

    return getFileType(file)?.kind || null;

}

/**
 * ***************************************************************************
 * Определить категорию файла по MIME.
 *
 * Обобщённые MIME дают `null`: по ним тип не определить.
 *
 * @param mime - MIME-тип.
 * @returns Категория или null.
 * ***************************************************************************
 */
export function getKindByMime(mime?: string): string | null {

    const normalized = normalizeMime(mime);

    if (!normalized || GENERIC_MIMES.includes(normalized)) return null;

    for (const kind of TABLES.kinds) {
        if (TABLES.kindMimes[kind]?.includes(normalized)) return kind;
    }

    return null;

}

/**
 * ***************************************************************************
 * Категория файла по MIME. Основная замена `IMAGE_MIMES.includes(mime)`.
 *
 * @param mime - MIME-тип.
 * @returns Категория (`image`, `video`, `audio`, ...) или null.
 * ***************************************************************************
 */
export function getKind(mime?: string): string | null {

    return getKindByMime(mime);

}

/**
 * ***************************************************************************
 * Проверить, что MIME принадлежит категории.
 *
 * @param kind - Категория (`image`, `video`, `audio`, ...).
 * @param mime - MIME-тип.
 * @returns true, если MIME относится к категории.
 * ***************************************************************************
 */
export function isKind(kind?: string, mime?: string): boolean {

    if (!kind || !TABLES.kinds.includes(kind)) return false;

    return (TABLES.kindMimes[kind] || []).includes(normalizeMime(mime));

}

/**
 * ***************************************************************************
 * Категория файла с приоритетом расширения над MIME.
 *
 * @param e - Объект-источник (см. `FileKindQuery`).
 * @returns Категория или null.
 * ***************************************************************************
 */
export function getFileKind(e?: FileKindQuery | null): string | null {

    return getKindByExtension(e?.file ?? e?.extension ?? e?.file_name) || getKindByMime(e?.mime) || null;

}

/**
 * ***************************************************************************
 * Проверить согласованность MIME с расширением.
 *
 * Обобщённый MIME (`application/octet-stream`) проверку пропускает: браузер
 * честно не знает тип для целого класса файлов, и клиент подставляет
 * резервный из `default` через `resolveMimeType`.
 *
 * @param file - Имя файла, Blob или объект File.
 * @param mime - MIME-тип (по умолчанию берётся из объекта File).
 * @returns true, если явного противоречия нет.
 * ***************************************************************************
 */
export function isMimeConsistent(file?: FileInput, mime?: string): boolean {

    // Справочник ещё не принят — сверять не с чем, проверку ведёт сервер
    if (TABLES.allowedExtensions.length === 0) return true;

    const entry = getFileType(file);

    // Расширение не в белом списке — дальше сверять нечего
    if (!entry) return false;

    // Для этого расширения сверка не определена — пропускаем
    if (!entry.mimes) return true;

    // У строки своя ветка: у неё нет `.type`, как и у Blob без имени
    const source = typeof file === "string" ? mime : (mime ?? file?.type);

    const normalized = normalizeMime(source);

    if (!normalized || GENERIC_MIMES.includes(normalized)) return true;

    return entry.mimes.includes(normalized);

}

/**
 * ***************************************************************************
 * Определить MIME для отправки на сервер.
 *
 * Порядок: `File.type` браузера -> резервный MIME из справочника для
 * расширения -> `application/octet-stream`. Сервер требует непустой MIME
 * (`MIME_TYPE_REQUIRED`), поэтому последний вариант — тоже лучше, чем
 * пустая строка.
 *
 * Резервный берётся из того же справочника, что и серверная проверка, —
 * клиент подставляет ровно то, что сервер примет.
 *
 * @param file - Файл или блоб.
 * @returns MIME-тип в нижнем регистре.
 * ***************************************************************************
 */
export function resolveMimeType(file?: FileInput): string {

    // Что сообщает браузер (у строки `.type` нет — как и у Blob без имени)
    const type = normalizeMime(typeof file === "string" ? undefined : file?.type);

    // Тип есть и он конкретный — доверяем браузеру
    if (type && !GENERIC_MIMES.includes(type)) return type;

    // Иначе смотрим резервный MIME по расширению
    return getDefaultMime(getExtension(file)) || "application/octet-stream";

}

/**
 * ***************************************************************************
 * Резервный MIME для расширения — что подставить, когда браузер не знает.
 *
 * @param extension - Расширение с точкой.
 * @returns MIME или null.
 * ***************************************************************************
 */
export function getDefaultMime(extension?: string): string | null {

    return getExtensionType(extension)?.default || null;

}

/**
 * ***************************************************************************
 * Расширения, ожидаемые для MIME — для проверки согласованности.
 *
 * @param mime - MIME-тип.
 * @returns Расширения (пустой массив, если MIME неизвестен).
 * ***************************************************************************
 */
export function getExtensionsForMime(mime?: string): string[] {

    return TABLES.mimeExtensions[normalizeMime(mime)] || [];

}

/**
 * ***************************************************************************
 * Текущий справочник целиком.
 * @returns kind -> расширение -> описание.
 * ***************************************************************************
 */
export function getFileTypes(): FileTypesCatalog {

    return CURRENT_FILE_TYPES;

}

/**
 * ***************************************************************************
 * Категории, которые знает платформа.
 * @returns Список категорий.
 * ***************************************************************************
 */
export function getKinds(): string[] {

    return [...TABLES.kinds];

}
