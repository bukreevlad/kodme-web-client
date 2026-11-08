// Импортируем utils
import { extractImageColors } from "./image_colors_extractor.js";

// Импортируем типы
import type { MediaInput, ThumbnailGeneratorResult } from "../../types/media.js";

/**
 * Генерирует метадату изображения: оригинальные размеры, массив thumbnails
 * разных размеров, микро-placeholder и акцентные цвета.
 *
 * Результат намеренно повторяет серверный контракт metadata.original, чтобы
 * компоненты вложений одинаково работали и с локальным файлом (до загрузки
 * на сервер), и с уже загруженным (где метадату присылает сервер).
 *
 * Цвета считаем здесь же, из уже декодированного <img>: отдельный вызов
 * извлекателя означал бы второй проход декодирования картинки, а на телефоне
 * это заметно дороже.
 *
 * @param {MediaInput} file - Файл изображения.
 * @param {Array<number>} [widths=[1200, 800, 400]] - Массив ширин thumbnails.
 * @returns {Promise<ThumbnailGeneratorResult>} - { original, thumbnails, placeholder, colors }
 */
export async function generateImageMetadata(file: MediaInput, widths: number[] = [1200, 800, 400]): Promise<ThumbnailGeneratorResult> {
    const url = URL.createObjectURL(file);
    const img = new Image();

    // 1. Загружаем изображение
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Не удалось загрузить изображение"));
        };
        img.src = url;
    });

    // Инициализируем результат ДО try, чтобы catch мог подчистить
    // blob-ссылки уже созданных миниатюр (results объявлен в блочной области
    // try и внутри catch был бы недоступен).
    const results: ThumbnailGeneratorResult = {
        original: {
            mime: file.type || "image/jpeg",
            size: file.size,
            width: 0,
            height: 0
        },
        thumbnails: [],
        placeholder: "",
        colors: null
    };

    try {
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        const aspectRatio = originalHeight / originalWidth;

        // Оригинальные размеры нужны всем потребителям (aspect-ratio в списке
        // сообщений, откат на 16:9 в просмотрщике) — заполняем сразу.
        results.original.width = originalWidth;
        results.original.height = originalHeight;

        // Акцентные цвета с уже декодированного изображения. Извлекатель не
        // бросает исключений, поэтому даже tainted canvas не уронит генерацию.
        results.colors = extractImageColors(img);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Без контекста генерировать превью нечем — осмысленная ошибка
        // в общий catch вместо TypeError
        if (!ctx) throw new Error("Не удалось получить контекст canvas 2d для превью");

        // 2. Генерируем основные thumbnails
        for (const targetWidth of widths) {
            const w = Math.min(targetWidth, originalWidth);
            const h = Math.round(w * aspectRatio);

            canvas.width = w;
            canvas.height = h;

            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            // Превращаем кадр в Blob (WebP).
            // toBlob отдаёт null, если холст «испорчен» (tainted) или слишком
            // большой — такое бывает на тяжёлых HEIC/PNG с телефона. Не роняем
            // весь файл из-за одной неудачной миниатюры, а просто пропускаем её.
            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/webp", 0.8));
            if (!blob) continue;

            results.thumbnails.push({
                _file: blob,
                _url: URL.createObjectURL(blob), // Ссылка для тега <img>
                size: blob.size,
                width: w,
                height: h,
                mime_type: "image/webp"
            });
        }

        // 3. Генерируем маленький placeholder с сохранением пропорций (ширина 20px)
        const pWidth = 20;
        const pHeight = Math.max(1, Math.round(pWidth * aspectRatio));

        canvas.width = pWidth;
        canvas.height = pHeight;

        ctx.clearRect(0, 0, pWidth, pHeight);
        ctx.drawImage(img, 0, 0, pWidth, pHeight);

        results.placeholder = canvas.toDataURL("image/webp", 0.3);

        return results;

    } catch (error) {

        // Часть миниатюр могла создаться до ошибки — их blob-ссылки иначе
        // остались бы висеть в памяти до перезагрузки страницы.
        for (const thumb of results?.thumbnails || []) {
            if (!thumb?._url) continue;
            try { URL.revokeObjectURL(thumb._url); } catch (e) { }
        }

        throw error;

    } finally {
        // Освобождаем память в любом случае
        URL.revokeObjectURL(url);
    }
}