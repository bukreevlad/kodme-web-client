// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { renderUpdate } from "./render_update.js";

// Импортируем handlers
import { trackChangeHandler } from "../handlers/track_change.js";

// Импортируем типы
import type { AudioPlayer } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на прогресс плеера.
 * @param form - Экземпляр формы плеера.
 * ***************************************************************************
 */
export function subscribeToPlayer(form: AudioPlayer): void {

    try {

        const track = form.manager?.audioData;
        if (!track) return;

        // Сохраняем ссылку на функцию, чтобы иметь возможность отписаться именно от неё
        if (!form._updateCallback) {
            form._updateCallback = (info) => {
                if (info.trackId !== form.currentTrackId) {
                    trackChangeHandler(form);
                    return;
                }
                renderUpdate(form, info);
            };
        }

        if (form.currentTrackId && form.currentTrackId !== track.id) {
            // invariant: id трека из вложения — строка либо число; менеджер
            // хранит подписки в Map и сопоставляет их с trackId из broadcast
            // один в один, поэтому числовой id проходит как есть
            form.manager.unsubscribe(form.currentTrackId as string, form._updateCallback);
        }

        form.currentTrackId = track.id ?? null;
        // invariant: тот же id, что и при отписке (см. выше)
        form.manager.subscribe(form.currentTrackId as string, form._updateCallback);

    } catch (error) {
        Logger.error(error);
    }

}
