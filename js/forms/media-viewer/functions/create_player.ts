// Импортируем utils
import { CacheManager } from "../../../utils/cache_manager.js";
import { calculateAspectRatio } from "../../../utils/helpers/calculate_aspect_ratio.js";
import * as StorageUrl from "../../../utils/network/storage_url.js";
import { FileRenditions } from "../../../utils/video/file_renditions.js";

// Импортируем components
import { VideoPlayer } from "../../../components/video_player.js";

// Импортируем functions
import { buildRenditions } from "./build_renditions.js";
import { destroyPlayer } from "./destroy_player.js";

// Импортируем events
import { subscribePlayerEvents } from "../events/player_events.js";

// Импортируем типы
import type { MediaItem } from "../types.js";
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Создание видеоплеера поверх нативного <video> активного слота.
 * @param form - Экземпляр формы.
 * @param video - Нативный тег видео из слота.
 * @param data - Данные медиафайла.
 * @returns Инициализация плеера.
 * ***************************************************************************
 */
export async function createPlayer(form: MediaViewer, video: HTMLVideoElement, data: MediaItem): Promise<void> {

    console.group("🎬 [MediaViewer] Инициализация плеера");

    // Блокируем повторный запуск, если плеер прямо сейчас создается
    if (form._isInitializing) {
        console.warn("⚠️ [MediaViewer] Плеер уже инициализируется, пропуск повторного вызова.");
        return;
    }
    form._isInitializing = true;

    // Гарантируем сброс флага при завершении
    const finishInit = () => { form._isInitializing = false; };

    // Очищаем старый плеер, если он был
    destroyPlayer(form);

    // СОХРАНЯЕМ ссылку на элемент для правильной очистки в будущем
    form.videoNode = video;

    // ОЧИЩАЕМ тег от мертвых Blob-ссылок перед стартом
    form.videoNode.removeAttribute('src');
    form.videoNode.load();

    const width = data?.metadata?.original?.width || 16;
    const height = data?.metadata?.original?.height || 9;

    let ratioString = "16:9";
    try {
        if (typeof calculateAspectRatio !== "undefined") {
            const ar = calculateAspectRatio(width, height);
            if (ar) ratioString = `${ar.simplified[0]}:${ar.simplified[1]}`;
        }
    } catch (e) { }

    const isFile = data?._file instanceof File || data?._file instanceof Blob;

    let mediaUrl = "";
    // Создаем blob для локального файла и запоминаем ссылку, чтобы потом
    // корректно освободить её через URL.revokeObjectURL (без утечек памяти)
    if (form._mediaBlobUrl) {
        try { URL.revokeObjectURL(form._mediaBlobUrl); } catch (e) { }
        form._mediaBlobUrl = null;
    }

    // invariant: isFile = true только когда _file — локальный Blob
    form._mediaBlobUrl = isFile && data._file ? URL.createObjectURL(data._file) : "";
    mediaUrl = form._mediaBlobUrl || CacheManager.getMediaSrc({
        url: StorageUrl.forStorage(data.id),
        file_token: data.token,
        type: "video"
    });

    const initVideoPlayer = () => {
        if (form.player) return;

        // Оборачиваем ТОТ ЖЕ нативный <video>, который уже лежит в слоте.
        // Это принципиально: адаптер рендераций цепляется именно к нему, а
        // Video.js 10 не подменяет медиаэлемент, а строит UI вокруг него.
        form.player = new VideoPlayer({
            video: video,
            insertInto: video.parentElement,
            options: {
                variant: "full",
                autoplay: false,
                playsinline: true,
                ratio: ratioString,
                className: "cdm-iv-player"
            }
        });

        subscribePlayerEvents(form, data);
    };

    const startPlayback = () => {
        setTimeout(async () => {
            try {
                if (form.player) await form.player.play();
                else if (video) await video.play();
            } catch (e) {
                try {
                    if (form.player) form.player.muted = true;
                    else if (video) video.muted = true;

                    if (form.player) await form.player.play();
                    else if (video) await video.play();
                } catch (err) { }
            }
        }, 100);
    };

    // Источник и меню качества.
    //
    // Рендерации — целые MP4-файлы (360/720/1080): FileRenditions
    // переключает их сменой src и сохраняет позицию (раздел 11 плана).
    // Если рендераций нет (крупный файл, старый документ, локальный blob),
    // играем оригинал.
    video.src = mediaUrl;
    initVideoPlayer();

    // Контролы packaged-скина: браузер может сбрасывать adoptedStyleSheets
    // теневого корня при подключении плеера к документу (шаблон формы
    // собирается через DOMParser — отдельный документ). Проверяем сразу
    // и отложенным тиком — модалка двигает DOM слота после открытия.
    form.player?.ensureSkinStyles?.();
    setTimeout(() => form.player?.ensureSkinStyles?.(), 300);

    const renditions = buildRenditions(data, isFile);

    if (renditions.length > 0) {
        const adapter = new FileRenditions({
            video: video,
            renditions: renditions,
            originalUrl: mediaUrl
        });

        form.player?.attachRenditions(adapter);

        // Синхронизация ПОСЛЕ attach: Video.js узнаёт о списке качества
        // только когда `video.videoRenditions` уже стоит на элементе
        // (так же подключает адаптер конференция, см. render_tracks.js).
        adapter.sync();
    }

    startPlayback();

    console.groupEnd();

    finishInit();

}
