// Импортируем utils
import { CacheManager } from "../../../utils/cache_manager.js";
import * as StorageUrl from "../../../utils/network/storage_url.js";

// Импортируем типы
import type { FileRenditionOption } from "../../../utils/video/file_renditions.js";
import type { MediaItem } from "../types.js";

/**
 * ***************************************************************************
 * Список рендераций для меню качества.
 *
 * Путь рендерации строит сервер по `?rendition=<label>` —
 * `{папка}/q/<label>.mp4` (раздел 11 плана). Клиент путь не собирает:
 * берёт выданные сервером метаданные и подставляет селектор.
 * @param data - Данные медиа.
 * @param isFile - Локальный файл (рендераций ещё нет).
 * @returns Пункты меню качества [{ label, width, url }].
 * ***************************************************************************
 */
export function buildRenditions(data: MediaItem, isFile: boolean): FileRenditionOption[] {

    const sources = data?.metadata?.renditions;

    // Локальный файл ещё не обработан сервером — рендераций нет
    if (isFile || !Array.isArray(sources) || sources.length === 0) {
        return [];
    }

    const list: FileRenditionOption[] = [];

    for (const rendition of sources) {

        if (!rendition?.label) continue;

        const url = CacheManager.getMediaSrc({
            url: StorageUrl.forStorage(data.id, { rendition: rendition.label }),
            file_token: data.token,
            type: "video"
        });

        list.push({
            label: rendition.label,
            width: rendition.width,
            url: url
        });

    }

    return list;

}
