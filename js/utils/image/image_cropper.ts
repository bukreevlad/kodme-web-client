/**
 * Координаты области кропа в натуральных пикселях исходника.
 */
interface CropCoords {
    /** Смещение по X. */
    x?: number;
    /** Смещение по Y. */
    y?: number;
    /** Ширина области. */
    width?: number;
    /** Высота области. */
    height?: number;
}

/**
 * Опции кропа изображения.
 */
interface CropImageOptions {
    /** Качество webp (0..1). */
    quality?: number;
    /** Верхний предел стороны выхода. */
    maxSize?: number;
}

/**
 * ***************************************************************************
 * cropImage - кроп изображения по координатам на canvas и возврат Blob (webp, 0.9).
 *
 * Кроп переехал с сервера (sharp + crop_coords) на
 * клиент. Пользователь двигает/зумит картинку в кроппере (forms/image-cropper),
 * тот отдаёт координаты области в натуральных пикселях исходника — здесь мы
 * вырезаем эту область на canvas и получаем готовый Blob «оригинала» аватарки,
 * который потом проходит обычный конвейер processMedia (превью, цвета, LQIP).
 *
 * Выход квадратный: аватарка круглая (см. selection в image-cropper), а
 * квадрат — самая плотная форма для круглой обрезки в CSS.
 *
 * @param {File | Blob} file - Исходный файл изображения.
 * @param {CropCoords} [coords] - Координаты области кропа в натуральных пикселях.
 * @param {CropImageOptions} [options] - Опции.
 * @returns {Promise<Blob>} - Кропнутое изображение (mime image/webp).
 * @throws {Error} Если картинка не загрузилась или canvas.toBlob не отработал.
 * ***************************************************************************
 */
export async function cropImage(file: File | Blob, coords?: CropCoords, options: CropImageOptions = {}): Promise<Blob> {

    // ---------- SET DEFAULT ----------

    const quality = options.quality ?? 0.9;
    const maxSize = Number(options.maxSize) || 1024;

    // ---------- LOAD ----------

    const url = URL.createObjectURL(file);

    const img = new Image();

    await new Promise<void>((resolve, reject) => {

        img.onload = () => resolve();
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Не удалось загрузить изображение для кропа"));
        };
        img.src = url;

    });

    try {

        // Координаты от кроппера уже в натуральных пикселях исходника.
        // Если прямоугольник не пришёл (защитный случай) — вырезаем кадр целиком
        const hasCoords = !!(coords?.width && coords?.height);

        // Границы области: вырезаем строго по координатам
        const sx = hasCoords ? Math.max(0, Math.round(Number(coords?.x) || 0)) : 0;
        const sy = hasCoords ? Math.max(0, Math.round(Number(coords?.y) || 0)) : 0;
        const sw = hasCoords ? Math.max(1, Math.round(Number(coords?.width) || 0)) : Math.max(1, img.naturalWidth);
        const sh = hasCoords ? Math.max(1, Math.round(Number(coords?.height) || 0)) : Math.max(1, img.naturalHeight);

        // Выход — квадрат по длинной стороне области, сверху ограничен
        // maxSize: аватарка 512×512/1024×1024, больше не нужно
        const outSize = Math.min(maxSize, Math.max(sw, sh));

        const canvas = document.createElement("canvas");
        canvas.width = outSize;
        canvas.height = outSize;

        const ctx = canvas.getContext("2d", { willReadFrequently: false });

        // Без контекста рисовать нечем — это ошибка, а не пустой результат
        if (!ctx) throw new Error("Не удалось получить контекст canvas 2d для кропа");

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outSize, outSize);

        // Blob webp с качеством 0.9
        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("canvas.toBlob не вернул Blob"));
            }, "image/webp", quality);
        });

    } finally {

        // Освобождаем blob-ссылку независимо от результата
        URL.revokeObjectURL(url);

    }

}
