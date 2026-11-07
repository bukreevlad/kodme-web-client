// Импортируем сторонние пакеты
import jsmediatags from "jsmediatags";

// Импортируем utils
import { Logger } from "../logs/logger.js";

// Импортируем типы
import type { MediaInput, MediaMetadata, MediaTags } from "../../types/media.js";

/**
 * Результат чтения тегов аудио: текстовые теги и вложенная обложка.
 */
export interface AudioTagsResult {
    /** Теги контейнера (null у отсутствующих полей). */
    tags: MediaTags;
    /** Blob вложенной обложки либо null. */
    coverBlob: Blob | null;
}

/**
 * Результат сбора метадаты аудио: метадата контракта v2 и обложка.
 */
export interface AudioMetadataResult {
    /** Метадата аудио (длительность, теги, пустые превью). */
    metadata: MediaMetadata;
    /** Blob обложки для последующей генерации превью либо null. */
    coverBlob: Blob | null;
}

// Максимум ожидания метаданных аудио. Без этого глюковый кодек (или файл,
// который телефон отдал с битым заголовком) держит импорт вложений намертво:
// обработка идёт в цикле по всем файлам и не должна вставать.
const DURATION_TIMEOUT_MS = 5000;

/**
 * ***************************************************************************
 * Читает длительность аудиофайла через нативный HTMLMediaElement.
 *
 * jsmediatags длительность не отдаёт, а распарсить контейнер вручную — лишний
 * код. Браузер уже умеет: достаточно смонтировать файл и дождаться
 * loadedmetadata. Потоковые m3u8/аудио без полного тела здесь не ожидаем —
 * на вход всегда приходит локальный File.
 *
 * @param {File|Blob} file - Аудиофайл.
 * @returns {Promise<number|null>} - Длительность в секундах или null.
 * ***************************************************************************
 */
function readDuration(file: MediaInput): Promise<number | null> {
    return new Promise<number | null>((resolve) => {

        const audio = document.createElement("audio");
        const url = URL.createObjectURL(file);

        // Снимаем обработчики и освобождаем blob-ссылку ровно один раз
        let done = false;
        const finish = (value: number | null) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            audio.onloadedmetadata = null;
            audio.onerror = null;
            try { URL.revokeObjectURL(url); } catch (e) { }
            audio.removeAttribute("src");
            audio.load();
            resolve(value);
        };

        const timer = setTimeout(() => {
            Logger.warn("[AudioMetadataExtractor] Таймаут чтения длительности");
            finish(null);
        }, DURATION_TIMEOUT_MS);

        audio.preload = "metadata";
        audio.muted = true;

        audio.onloadedmetadata = () => {
            const duration = audio.duration;

            // Infinity/NaN бывает у потоков и битых заголовков — такое
            // значение компоненты переведут в "00:00", поэтому не отдаём его.
            if (!Number.isFinite(duration) || duration < 0) {
                finish(null);
                return;
            }

            finish(duration);
        };

        audio.onerror = () => {
            Logger.warn("[AudioMetadataExtractor] Браузер не смог прочитать аудио");
            finish(null);
        };

        audio.src = url;

    });
}

/**
 * ***************************************************************************
 * Читает ID3/Vorbis-теги и вытаскивает встроенную обложку.
 *
 * Функция не бросает исключений: отсутствие тегов — это норма (запись с
 * телефона, WAV без ID3), а не ошибка. В этом случае просто возвращаем
 * пустые теги и coverBlob = null.
 *
 * @param {File|Blob} file - Аудиофайл.
 * @returns {Promise<{tags: Object, coverBlob: Blob|null}>} - Теги и обложка.
 * ***************************************************************************
 */
function readTags(file: MediaInput): Promise<AudioTagsResult> {
    return new Promise<AudioTagsResult>((resolve) => {

        const empty = (): AudioTagsResult => ({
            tags: { album: null, genre: null, title: null, artist: null },
            coverBlob: null
        });

        try {

            jsmediatags.read(file, {
                onSuccess: (tag) => {
                    const raw = tag?.tags || {};

                    // Формат обложки приходит как mime ("image/jpeg"), но у
                    // части контейнеров — просто "JPG". Приводим к mime, иначе
                    // генератор миниатюр не сможет открыть Blob.
                    let format = raw?.picture?.format || "";
                    if (format && !format.includes("/")) format = `image/${format.toLowerCase()}`;

                    const coverBlob = raw?.picture?.data
                        ? new Blob([new Uint8Array(raw.picture.data)], { type: format || "image/jpeg" })
                        : null;

                    resolve({
                        tags: {
                            album: raw.album || null,
                            genre: raw.genre || null,
                            title: raw.title || null,
                            artist: raw.artist || null
                        },
                        coverBlob
                    });
                },

                onError: () => resolve(empty())
            });

        } catch (error) {
            Logger.warn("[AudioMetadataExtractor] Ошибка чтения тегов:", error);
            resolve(empty());
        }

    });
}

/**
 * ***************************************************************************
 * Собирает метадату аудиофайла: оригинальные размеры, длительность, теги и
 * обложку для последующей генерации миниатюр.
 *
 * Повторяет серверный контракт metadata, чтобы компоненты вложений одинаково
 * работали с локальным файлом и с уже загруженным.
 *
 * @param {File|Blob} file - Аудиофайл (mp3, m4a, flac, wav, ogg).
 * @returns {Promise<{metadata: Object, coverBlob: Blob|null}>} - Метадата и обложка.
 * ***************************************************************************
 */
export async function extractAudioMetadata(file: MediaInput): Promise<AudioMetadataResult> {
    try {

        // Длительность и теги читаем параллельно: оба ходят в один файл,
        // но в разные подсистемы браузера.
        const [duration, { tags, coverBlob }] = await Promise.all([
            readDuration(file),
            readTags(file)
        ]);

        return {
            metadata: {
                hls: false,
                tags: tags,
                original: {
                    mime: file.type || "audio/mpeg",
                    size: file.size,
                    width: 0,
                    height: 0,
                    duration: duration
                },
                qualities: [],
                wave_form: [],
                thumbnails: [],
                placeholder: ""
            },
            coverBlob: coverBlob
        };

    } catch (error) {
        Logger.warn("[AudioMetadataExtractor] Ошибка сбора метадаты:", error);

        return {
            metadata: {
                hls: false,
                tags: { album: null, genre: null, title: null, artist: null },
                original: {
                    mime: file.type || "audio/mpeg",
                    size: file.size,
                    width: 0,
                    height: 0,
                    duration: null
                },
                qualities: [],
                wave_form: [],
                thumbnails: [],
                placeholder: ""
            },
            coverBlob: null
        };
    }
}
