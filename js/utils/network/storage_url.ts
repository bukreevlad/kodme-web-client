/**
 * ***************************************************************************
 * StorageUrl - единая сборка ссылок на файлы хранилища.
 *
 * Зачем нужен модуль:
 * - URL собирался в 7+ местах как `${location.protocol}//${location.hostname}/api/v1/storage/${id}`.
 *   `hostname` не содержит порт, поэтому на локальной разработке (:3000, :8080)
 *   и на любом нестандартном порту ссылки указывали на порт 443/80 — файлы
 *   не открывались, превью не грузились. Правильный источник — `origin`.
 * - Терялся параметр `?size=N` для превью и `?rendition=label` для видео:
 *   их добавляли вручную, из-за чего один и тот же id мог прийти с разными
 *   query в разных компонентах и не попадать в кеш Service Worker.
 *
 * Модуль ничего не кеширует и не ходит в сеть — только строит строку.
 * ***************************************************************************
 */

/**
 * Опции сборки ссылки на файл хранилища.
 */
export interface StorageUrlOptions {
    /** Размер превью (`?size=400`). Без него — оригинал. */
    size?: number | string | undefined;
    /** Метка видео-рендерации (`?rendition=720`): 360 | 720 | 1080. Без неё — оригинал или превью. */
    rendition?: string;
    /** Явный origin (для тестов/SSR). По умолчанию — текущий. */
    origin?: string;
}

/**
 * ***************************************************************************
 * Базовый путь хранилища (роут API хранилища).
 * ***************************************************************************
 */
const STORAGE_BASE_PATH = "/api/v1/storage";

/**
 * ***************************************************************************
 * Собрать ссылку на файл в хранилище.
 * @param {string | number} id - Id документа/файла.
 * @param {StorageUrlOptions} [options] - Опции.
 * @returns {string} - Готовая ссылка или пустая строка, если id не передан.
 * ***************************************************************************
 */
export function forStorage(id: string | number, options: StorageUrlOptions = {}): string {

    // Без id ссылка бессмысленна: лучше пустая строка, чем URL с `undefined`
    if (id === null || id === undefined || id === "") return "";

    // origin учитывает порт, hostname — нет. Именно это и было причиной
    // нерабочих превью на нестандартных портах
    const origin = options.origin || window.location.origin;

    // Собираем query явно: порядок параметров стабилен, поэтому
    // одинаковые ссылки с одинаковым id попадают в кеш SW как один ресурс
    const query = buildQuery(options);

    return `${origin}${STORAGE_BASE_PATH}/${id}${query}`;

}

/**
 * ***************************************************************************
 * Текущий origin приложения с портом.
 * @returns {string} - Например «https://domain.ru» или «http://localhost:3000».
 * ***************************************************************************
 */
export function getOrigin(): string {

    return window.location.origin;

}

/**
 * ***************************************************************************
 * Приватная функция: собрать query-строку.
 * @param {StorageUrlOptions} options - Опции (см. forStorage).
 * @returns {string} - Query с ведущим «?» или пустая строка.
 * ***************************************************************************
 */
function buildQuery(options: StorageUrlOptions): string {

    const parts: string[] = [];

    // Размер превью: 0 и "" — невалидны, пропускаем
    if (options.size !== undefined && options.size !== null && options.size !== "") {
        parts.push(`size=${encodeURIComponent(options.size)}`);
    }

    // Видео-рендерация: метка качества (360/720/1080). Пустую не шлём,
    // иначе сервер вернёт оригинал, а мы зря сломаем ключ кеша SW.
    if (options.rendition !== undefined && options.rendition !== null && options.rendition !== "") {
        parts.push(`rendition=${encodeURIComponent(options.rendition)}`);
    }

    return parts.length ? `?${parts.join("&")}` : "";

}
