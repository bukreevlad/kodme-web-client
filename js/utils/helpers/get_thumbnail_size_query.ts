/**
 * Миниатюра размера (объект из ответа сервера).
 */
export interface Thumbnail {

    /** Ширина миниатюры в пикселях. */
    width: number;

    /** Остальные поля миниатюры (высота, ссылка и т.п.). */
    [key: string]: unknown;

}

/**
 * Результат подбора миниатюры под целевой размер.
 */
export interface ThumbnailSizeQuery {

    /** Ближайшая большая (или самая большая) миниатюра либо false. */
    thumb: Thumbnail | false;

    /** Строка вида "?size=1200" или пустая строка. */
    string: string;

}

/**
 * Возвращает query-параметр размера для ближайшей большей миниатюры.
 * @param thumbnails - Массив объектов миниатюр [{width: 100, ...}].
 * @param targetSize - Желаемая ширина в пикселях (по умолчанию 800).
 * @returns Объект { thumb, string } (см. ThumbnailSizeQuery).
 */
export function getThumbnailSizeQuery(
    thumbnails: readonly Thumbnail[] | null | undefined,
    targetSize = 800
): ThumbnailSizeQuery {

    // Если массив пустой
    if (!thumbnails || thumbnails.length === 0) {
        return {
            thumb: false,
            string: ""
        };
    }

    // Делаем копию через [...spread], чтобы не сломать данные в других частях приложения.
    const sortedThumbnails = [...thumbnails].sort((a, b) => a.width - b.width);

    // Ищем первую миниатюру, которая больше или равна целевому размеру
    const match = sortedThumbnails.find(t => t.width >= targetSize)
        || sortedThumbnails[sortedThumbnails.length - 1]; // или берем самую большую

    // Возвращаем результат
    return {
        thumb: match ? match : false,
        string: match ? `?size=${match.width}` : ""
    };

}
