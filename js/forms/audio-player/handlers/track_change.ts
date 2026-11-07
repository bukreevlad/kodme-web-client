// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { updateTrackInfo } from "../functions/update_track_info.js";
import { subscribeToPlayer } from "../functions/subscribe.js";

// Импортируем типы
import type { AudioPlayer } from "../index.js";

/**
 * ***************************************************************************
 * Обработка смены трека: обновление данных, плейлиста и переподписка.
 * @param form - Экземпляр формы плеера.
 * ***************************************************************************
 */
export function trackChangeHandler(form: AudioPlayer): void {

    try {

        updateTrackInfo(form); // Обновление данных трека
        form._renderPlaylist(); // Перерисовываем плейлист, чтобы обновить активный пункт
        subscribeToPlayer(form); // Переподписываемся на новый ID трека

    } catch (error) {
        Logger.error(error);
    }

}
