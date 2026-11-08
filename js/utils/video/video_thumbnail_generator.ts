// Импортируем utils
import { Logger } from "../logs/logger.js";
import { extractImageColors } from "../image/image_colors_extractor.js";

// Импортируем типы
import type { MediaInput, VideoThumbnailResult } from "../../types/media.js";

/**
 * ***************************************************************************
 * Генерирует метадату видео: оригинальные размеры и длительность, массив
 * thumbnails разных размеров и микро-placeholder.
 *
 * Результат намеренно повторяет серверный контракт metadata, чтобы компоненты
 * вложений одинаково работали и с локальным файлом (до загрузки на сервер), и
 * с уже загруженным (где метадату присылает сервер).
 *
 * Локально HLS ещё не существует (его собирает сервер), поэтому hls = false.
 *
 * @param {MediaInput} file - Видео файл.
 * @param {Array<number>} [widths=[1200, 800, 400]] - Массив ширин thumbnails.
 * @param {number} [seekTime=1] - Время кадра в секундах.
 * @returns {Promise<VideoThumbnailResult>} - { hls, tags, original, qualities, wave_form, thumbnails, placeholder, colors }
 * ***************************************************************************
 */
export function generateVideoMetadata(file: MediaInput, widths: number[] = [1200, 800, 400], seekTime: number = 1): Promise<VideoThumbnailResult> {
    return new Promise<VideoThumbnailResult>((resolve, reject) => {

        // Создаем видеоэлемент
        const video = document.createElement("video");
        const videoUrl = URL.createObjectURL(file);

        // Уже созданные blob-ссылки миниатюр. Нужны, чтобы при ошибке в
        // середине генерации не оставить их висеть в памяти.
        const createdUrls: string[] = [];

        // Функция освобождения ресурсов. Вызывается и при успехе, и при ошибке.
        const cleanup = () => {
            for (const url of createdUrls) {
                try { URL.revokeObjectURL(url); } catch (e) { }
            }
            createdUrls.length = 0;
            try { URL.revokeObjectURL(videoUrl); } catch (e) { }
            video.removeAttribute("src");
            video.load();
        };

        // Устанавливаем ссылку
        video.src = videoUrl;
        video.preload = "metadata";
        video.muted = true;
        // playsinline обязателен на iOS: без него Safari не отдаёт метадату
        // для видео, выбранного с телефона, и обработка падает по таймауту.
        video.playsInline = true;

        // Основная логика генерации. Объявлена до навешивания обработчиков,
        // чтобы из них нельзя было попасть в temporal dead zone.
        const handleSeeked = async () => {
            try {

                const originalWidth = video.videoWidth;
                const originalHeight = video.videoHeight;
                const aspectRatio = originalWidth > 0 ? originalHeight / originalWidth : 1;

                const results: VideoThumbnailResult = {
                    hls: false,
                    tags: {},
                    original: {
                        mime: file.type || "video/mp4",
                        size: file.size,
                        width: originalWidth,
                        height: originalHeight,
                        duration: Number.isFinite(video.duration) ? video.duration : null
                    },
                    qualities: [],
                    wave_form: [],
                    thumbnails: [],
                    placeholder: "",
                    colors: null
                };

                // Без размеров кадра отдаём хотя бы оригинальные метаданные:
                // компоненты сразу выставят правильный aspect-ratio по оригиналу.
                if (!originalWidth || !originalHeight) {
                    cleanup();
                    resolve(results);
                    return;
                }

                // Акцентные цвета с кадра, который уже загружен в <video>:
                // извлекатель сам отрисует его на маленький холст.
                results.colors = extractImageColors(video);

                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                // Без контекста генерировать превью нечем: бросаем осмысленную
                // ошибку, её поймает общий catch
                if (!ctx) throw new Error("Не удалось получить контекст canvas 2d для превью");

                // 1. Генерируем основные thumbnails
                for (const targetWidth of widths) {

                    const w = Math.min(targetWidth, originalWidth);
                    const h = Math.round(w * aspectRatio);

                    canvas.width = w;
                    canvas.height = h;
                    ctx.clearRect(0, 0, w, h);
                    ctx.drawImage(video, 0, 0, w, h);

                    // Превращаем кадр в Blob (WebP). null бывает на слишком
                    // больших холстах — одну неудачную миниатюру пропускаем,
                    // а не роняем всё вложение.
                    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/webp", 0.8));
                    if (!blob) continue;

                    const blobUrl = URL.createObjectURL(blob);
                    createdUrls.push(blobUrl);

                    results.thumbnails.push({
                        _file: blob,
                        _url: blobUrl, // Ссылка для тега <img>
                        size: blob.size,
                        width: w,
                        height: h,
                        mime_type: "image/webp"
                    });

                }

                // 2. Генерируем маленький placeholder (20px по ширине)
                const pWidth = 20;
                const pHeight = Math.max(1, Math.round(pWidth * aspectRatio));

                canvas.width = pWidth;
                canvas.height = pHeight;
                ctx.clearRect(0, 0, pWidth, pHeight);
                ctx.drawImage(video, 0, 0, pWidth, pHeight);

                results.placeholder = canvas.toDataURL("image/webp", 0.3);

                // Чистим ресурсы. Ссылку videoUrl и обработчики снимаем, а
                // blob-ссылки миниатюр оставляем — они ещё нужны компонентам
                // для показа превью, пока файл не загружен на сервер.
                video.onloadedmetadata = null;
                video.onseeked = null;
                video.onerror = null;
                try { URL.revokeObjectURL(videoUrl); } catch (e) { }
                video.removeAttribute("src");
                video.load();

                resolve(results);

            } catch (error) {
                cleanup();
                reject(error);
            }
        };

        // Данные загрузились
        video.onloadedmetadata = () => {

            // Кадр ближе к началу ролика, но не нулевой: в первом кадре часто
            // чёрная заставка или логотип, и превью получается бесполезным.
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            const target = duration > 0 ? Math.min(seekTime, Math.max(0, duration - 0.1)) : 0;

            // Если перемотка не нужна (длительность неизвестна или кадр и так
            // в начале) — читаем метадату сразу, не дожидаясь onseeked.
            if (target === 0) {
                video.onseeked = null;
                handleSeeked();
                return;
            }

            video.currentTime = target;
        };

        // Перематываем
        video.onseeked = () => handleSeeked();

        // Ошибка декодирования: отдаём пустые метаданные, а не reject.
        // Вложение должно показаться в списке сообщений даже если превью
        // построить не удалось — сработает фолбэк на сам файл.
        video.onerror = () => {
            Logger.warn("[VideoThumbnailGenerator] Не удалось прочитать метадату видео");
            cleanup();
            resolve({
                hls: false,
                tags: {},
                original: {
                    mime: file.type || "video/mp4",
                    size: file.size,
                    width: 0,
                    height: 0,
                    duration: null
                },
                qualities: [],
                wave_form: [],
                thumbnails: [],
                placeholder: "",
                colors: null
            });
        };

    });
}
