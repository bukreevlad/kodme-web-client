// Импортируем utils
import { Logger } from "../logs/logger.js";

// Импортируем типы
import type { MediaInput, VideoRenditionItem } from "../../types/media.js";

/**
 * Пресет рендерации качества.
 */
interface RenditionPreset {
    /** Метка качества (360/720/1080). */
    label: string;
    /** Целевая ширина. */
    width: number;
    /** Целевая высота. */
    height: number;
    /** Битрейт видеодорожки. */
    videoBitrate: number;
    /** Битрейт аудиодорожки. */
    audioBitrate: number;
}

/**
 * Метаданные видео (ширина/высота/длительность кадра).
 */
interface VideoMeta {
    /** Ширина кадра. */
    width: number;
    /** Высота кадра. */
    height: number;
    /** Длительность в секундах. */
    duration: number;
}

/**
 * Результат транскодинга одной рендерации.
 */
interface TranscodedRendition {
    /** Высота рендерации. */
    width: number;
    /** Ширина рендерации. */
    height: number;
    /** Собранный MP4-файл. */
    blob: Blob;
    /** Размер в байтах. */
    bytes: number;
}

/**
 * ****************************************************************************
 * Генерирует MP4-рендерации видео для выбора качества в плеере.
 *
 * Правила:
 * 1. Размер оригинала > MAX_RENDITION_FILE_SIZE_BYTES (100 МБ) → рендераций нет.
 * 2. Метка добавляется, только если labelWidth < original.width.
 * 3. Порядок — от меньшего к большему (360, 720, 1080).
 * 4. Перед стартом проверяем возможность кодирования (canEncodeVideo).
 *    Если недоступно — рендераций нет, файл уйдёт оригиналом.
 * 5. Фича управляется флагом RENDITIONS_ENABLED (см. ниже). Сейчас он
 *    выключен: качества не создаются, отправляется оригинал.
 * Кодирование — MP4/H.264 (Mp4OutputFormat).
 *
 * @param {MediaInput} file - Видео файл.
 * @returns {Promise<VideoRenditionItem[]>} - Массив рендераций качества.
 * ****************************************************************************
 */
// ***************************************************************************
// Флаг генерации рендераций качества.
//
// Временно ВЫКЛЮЧЕН: клиент отправляет только оригинал, а плеер играет его
// прогрессивно. Весь механизм создания качеств (транскодинг 360/720/1080)
// ниже сохранён целиком и готов к возврату — достаточно поставить `true`.
// ***************************************************************************
export const RENDITIONS_ENABLED = false;

const MAX_RENDITION_FILE_SIZE_BYTES = 104_857_600; // 100 МБ

const PRESETS: RenditionPreset[] = [
    {
        label: "360",
        width: 640,
        height: 360,
        videoBitrate: 800_000,
        audioBitrate: 96_000
    },
    {
        label: "720",
        width: 1280,
        height: 720,
        videoBitrate: 2_800_000,
        audioBitrate: 128_000
    },
    {
        label: "1080",
        width: 1920,
        height: 1080,
        videoBitrate: 5_000_000,
        audioBitrate: 192_000
    }
];

export async function generateVideoRenditions(file: MediaInput): Promise<VideoRenditionItem[]> {

    const result: VideoRenditionItem[] = [];

    // ---------- FEATURE FLAG ----------

    // Функционал временно выключен (см. RENDITIONS_ENABLED выше): качеств не
    // создаём, оригинал уйдёт как есть. Тяжёлый транскодинг не запускаем
    // вовсе, поэтому выбор и отправка видео не зависят от его размера.
    if (!RENDITIONS_ENABLED) {
        Logger.info(
            `[renditions] выключено (RENDITIONS_ENABLED=false): отправляем оригинал без качеств`
        );
        return result;
    }

    const startedAt = performance.now();

    try {

        // ---------- CHECK SIZE ----------
        const size = file?.size || 0;

        // Диагностика: видно, дошло ли дело до генерации и с каким файлом
        Logger.debug(
            `[renditions] старт: name="${file?.name || "?"}", size=${size} Б, type="${file?.type || ""}"`
        );

        if (size > MAX_RENDITION_FILE_SIZE_BYTES) {
            Logger.info(
                `[renditions] пропуск: размер ${size} Б больше лимита ${MAX_RENDITION_FILE_SIZE_BYTES} Б`
            );
            return result;
        }

        // ---------- LOAD VIDEO META ----------
        const metaStartedAt = performance.now();
        const meta = await _getVideoMeta(file);
        if (!meta?.width || !meta?.height) {
            Logger.warn(`[renditions] пропуск: не удалось получить размеры кадра`, meta);
            return result;
        }

        const originalWidth = meta.width;
        const originalHeight = meta.height;

        Logger.debug(
            `[renditions] исходник ${originalWidth}x${originalHeight}, длительность ${meta.duration} с (meta за ${Math.round(performance.now() - metaStartedAt)} мс)`
        );

        // ---------- CHECK CAN ENCODE H.264 ----------

        // Проверяем кодировщик один раз до цикла: если его нет (старый Safari,
        // окружение без WebCodecs), рендераций не будет вовсе — файл уйдёт
        // оригиналом и сыграет прогрессивно.
        const can = await _canEncodeH264();
        if (!can) {
            Logger.warn(`[renditions] пропуск: canEncodeVideo("avc") = false (нет WebCodecs/H.264)`);
            return result;
        }

        Logger.debug(`[renditions] кодировщик H.264 доступен`);

        // Сортируем пресеты от меньшего к большему (по ширине)
        const presets = PRESETS.slice().sort((a, b) => a.width - b.width);

        for (const preset of presets) {

            // Метка добавляется, только если labelWidth < original.width
            if (preset.width >= originalWidth) {
                Logger.debug(
                    `[renditions] ${preset.label}: пропуск — ширина пресета ${preset.width} >= ширины оригинала ${originalWidth}`
                );
                continue;
            }

            // ---------- TRANSCODE ----------
            try {
                const presetStartedAt = performance.now();
                Logger.debug(`[renditions] ${preset.label}: старт транскодинга`);

                const rendition = await _transcodeRendition(file, preset, originalWidth, originalHeight);

                if (rendition?.blob) {
                    result.push({
                        label: preset.label,
                        width: rendition.width,
                        height: rendition.height,
                        blob: rendition.blob,
                        mimeType: "video/mp4",
                        bytes: rendition.bytes
                    });

                    Logger.info(
                        `[renditions] ${preset.label}: готово за ${Math.round(performance.now() - presetStartedAt)} мс, ${rendition.width}x${rendition.height}, ${rendition.bytes} Б`
                    );
                } else {
                    Logger.warn(
                        `[renditions] ${preset.label}: нет блоба, пропускаем (за ${Math.round(performance.now() - presetStartedAt)} мс)`
                    );
                }
            } catch (error) {
                Logger.error(`[renditions] ${preset.label}: ошибка транскодинга`, error);
                // Не роняем весь процесс генерации — просто пропускаем эту рендерку
            }

        }

        Logger.info(
            `[renditions] итог: ${result.length} шт. [${result.map(r => r.label).join(", ")}] за ${Math.round(performance.now() - startedAt)} мс`
        );

        return result;

    } catch (error) {
        Logger.error(
            `[renditions] общая ошибка за ${Math.round(performance.now() - startedAt)} мс`,
            error
        );
        return result;
    }

}

/**
 * ****************************************************************************
 * Получает метаданные видео (ширина/высота/длительность).
 * ****************************************************************************
 */
function _getVideoMeta(file: MediaInput): Promise<VideoMeta> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const url = URL.createObjectURL(file);

        const cleanup = () => {
            try { URL.revokeObjectURL(url); } catch (e) { }
            try { video.removeAttribute("src"); video.load(); } catch (e) { }
        };

        video.preload = "metadata";
        video.onloadedmetadata = () => {
            const meta = {
                width: video.videoWidth,
                height: video.videoHeight,
                duration: video.duration
            };
            cleanup();
            resolve(meta);
        };
        video.onerror = (error) => {
            cleanup();
            reject(error);
        };
        video.src = url;
    });
}

/**
 * ****************************************************************************
 * Проверяет возможность кодирования H.264 (avc).
 * ****************************************************************************
 */
async function _canEncodeH264(): Promise<boolean> {
    try {
        const { canEncodeVideo } = await import("mediabunny");
        const res = await canEncodeVideo("avc");
        return !!res;
    } catch (error) {
        Logger.error(error);
        return false;
    }
}

/**
 * ****************************************************************************
 * Транскодирует рендерку по пресету.
 * ****************************************************************************
 */
async function _transcodeRendition(file: MediaInput, preset: RenditionPreset, originalWidth: number, originalHeight: number): Promise<TranscodedRendition | null> {

    try {

        // mediabunny грузим динамически: модуль тяжёлый, и он нужен только
        // когда видео действительно перекодируется
        const { Input, Output, Conversion, Mp4OutputFormat, BufferTarget, BlobSource, ALL_FORMATS } = await import("mediabunny");

        // Ширину оставляем из пресета, а высоту пересчитываем из пропорций
        // оригинала: растягивать кадр нельзя.
        const scale = preset.width / originalWidth;
        const outWidth = Math.round(originalWidth * scale);
        const outHeight = Math.round(originalHeight * scale);

        // Вход — оригинальный файл из памяти браузера
        const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });

        // Выход целиком в памяти: файл уедет в S3 одним POST, поэтому
        // буфер нужен до отправки, а не потоком.
        const target = new BufferTarget();
        const output = new Output({ format: new Mp4OutputFormat(), target });

        const initStartedAt = performance.now();
        const conversion = await Conversion.init({
            input: input,
            output: output,
            video: {
                codec: "avc",
                width: outWidth,
                height: outHeight,
                // Если указаны и ширина, и высота, mediabunny требует явный
                // алгоритм вписывания. Пропорции уже сохранены в outWidth/
                // outHeight, поэтому `fill` просто вписывает кадр в этот
                // прямоугольник без letterbox/обрезки (расхождение — доли
                // пикселя от округления).
                fit: "fill",
                bitrate: preset.videoBitrate
            },
            audio: {
                codec: "aac",
                bitrate: preset.audioBitrate
            }
        });

        // Диагностика: видно, что Conversion.init завершился и валиден ли он
        Logger.debug(
            `[renditions] ${preset.label}: Conversion.init за ${Math.round(performance.now() - initStartedAt)} мс, isValid=${conversion.isValid}`
        );

        // Конверсия может оказаться несовместимой (нет видеодорожки и т.п.)
        if (!conversion.isValid) {
            Logger.warn(`[renditions] ${preset.label}: conversion.isValid = false — пропуск`);
            return null;
        }

        const runStartedAt = performance.now();
        await conversion.execute();

        Logger.debug(
            `[renditions] ${preset.label}: execute за ${Math.round(performance.now() - runStartedAt)} мс`
        );

        const buffer = target.buffer;
        if (!buffer) {
            Logger.warn(`[renditions] ${preset.label}: target.buffer пуст после execute`);
            return null;
        }

        const blob = new Blob([buffer], { type: "video/mp4" });

        return {
            width: outWidth,
            height: outHeight,
            blob: blob,
            bytes: blob.size
        };

    } catch (error) {
        Logger.error(`[renditions] ${preset.label}: исключение`, error);
        return null;
    }

}
