// Импортируем utils
import { CacheManager } from "../../../utils/cache_manager.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";

// Импортируем functions
import { createPlayer } from "./create_player.js";

// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Рендер одного слота (prev / active / next): изображение или видео.
 * @param form - Экземпляр формы.
 * @param slotEl - Контейнер слота в треке.
 * @param index - Индекс медиафайла (null - пустой слот).
 * @param isActive - Активный ли это слот (по умолчанию false).
 * @returns Рендер слота.
 * ***************************************************************************
 */
export async function renderSlot(
    form: MediaViewer,
    slotEl: Element | null,
    index: number | null,
    isActive = false
): Promise<void> {

    if (slotEl) slotEl.innerHTML = '';
    if (index === null || !form.media[index]) return;

    const data = form.media[index];
    const isVideo = data?.mime_type?.startsWith("video/");

    const canvas = document.createElement('div');
    canvas.className = "cdm-iv-canvas will-change-[transform,opacity] [backface-visibility:hidden] flex items-center justify-center w-full h-full";

    if (isActive) {
        form.elements.canvas = canvas;
    }

    if (isVideo) {
        const video = document.createElement('video');
        video.className = "cdm-iv-image w-full h-full object-contain rounded-md select-none";
        video.setAttribute('playsinline', '');
        video.draggable = false;

        // Постер для НЕактивных слотов. Локальный файл ещё не на сервере,
        // поэтому серверный URL вернул бы 404 — берём локальное превью.
        const thumbnails = data?.metadata?.thumbnails;
        if (thumbnails && !isActive) {
            const sizeParam = getThumbnailSizeQuery(thumbnails, 800);
            const thumb = sizeParam.thumb;

            if (thumb !== false && (thumb._file instanceof File || thumb._file instanceof Blob)) {
                // invariant: локальные превью создаются парой — Blob (_file)
                // и blob:-ссылка (_url), поэтому у найденного _file есть _url
                video.poster = thumb._url as string;
            } else {
                video.poster = CacheManager.getMediaSrc({
                    url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${data.id}${sizeParam.string}`,
                    file_token: data.token,
                    type: "image"
                });
            }
        }

        canvas.appendChild(video);
        slotEl?.appendChild(canvas);

        // Плеер создаём только для активного слота
        if (isActive) {
            await createPlayer(form, video, data);
        }

    } else {
        const img = document.createElement('img');
        img.className = "cdm-iv-image max-w-[90vw] max-h-[90vh] object-contain select-none pointer-events-none rounded-md";
        img.draggable = false;

        let src = "";
        if (data?._file instanceof File || data?._file instanceof Blob) {
            src = URL.createObjectURL(data._file);
        } else if (data?._objectUrl) {
            src = data._objectUrl;
        } else {
            const thumbnails = data?.metadata?.thumbnails;
            const sizeParam = getThumbnailSizeQuery(thumbnails, 1200);
            const url = `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${data.id}${sizeParam.string}`;
            src = CacheManager.getMediaSrc({ url, file_token: data.token, type: "image" });
        }
        img.src = src;
        canvas.appendChild(img);
        slotEl?.appendChild(canvas);
    }

}
