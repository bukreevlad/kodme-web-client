// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";
import { CacheManager } from "../../../utils/cache_manager.js";

// Импортируем functions
import { renderWaveForm } from "./render_wave_form.js";

// Импортируем типы
import type { AudioPlayer } from "../index.js";
import { isThumbnails } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Обновление статической информации о треке (обложка, тексты, осциллограмма).
 * @param form - Экземпляр формы плеера.
 * ***************************************************************************
 */
export function updateTrackInfo(form: AudioPlayer): void {

    try {

        // Текущий трек
        const track = form.manager?.audioData;
        if (!track) return;

        // Устанавливаем элементы
        const coverImg = form.tpl?.querySelector<HTMLImageElement>("[data-thumbnail]");
        const coverIcon = form.tpl?.querySelector("[data-cover] >.cdm-icon");

        // Ищем ближайший подходящий размер превью
        const thumbnails = track.metadata?.thumbnails;
        let mediaUrl: string | null = null;

        if (isThumbnails(thumbnails)) {

            // Получение размера миниатюры
            const sizeQuery = getThumbnailSizeQuery(thumbnails, 800);
            const thumbFile = sizeQuery.thumb ? sizeQuery.thumb._file : null;

            // Проверяем instance локального файла
            if (thumbFile instanceof File || thumbFile instanceof Blob) {

                // Создаем временную ссылку для браузера
                mediaUrl = URL.createObjectURL(thumbFile);

            } else {

                // Формируем ссылку через CacheManager
                mediaUrl = CacheManager.getMediaSrc({
                    url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${track.id}${sizeQuery.string}`,
                    file_token: track.token,
                    type: "image"
                });

            }

        }

        // Устанавливаем обложку трека
        if (coverImg && coverIcon) {
            if (mediaUrl) {
                coverIcon.classList.add("hidden");
                coverImg.src = mediaUrl;
            } else {
                coverIcon.classList.remove("hidden");
                coverImg.src = "";
            }
        }

        // Тексты
        const titleEl = form.tpl?.querySelector("[data-title]");
        const authorEl = form.tpl?.querySelector("[data-author]");
        if (titleEl) titleEl.textContent = track.title || t("forms.audio_player.unknown_track");
        if (authorEl) authorEl.textContent = track.author || t("forms.audio_player.unknown_author");

        // Рендерим wave bars
        renderWaveForm(form);

    } catch (error) {
        Logger.error(error);
    }

}
