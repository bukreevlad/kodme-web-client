// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BroadcastsSettings } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение выбранного типа проигрывания трансляции (flv / hls / rtc)
 * в настройки сессии пользователя.
 * @param form - Экземпляр диалога настроек трансляций.
 * ***************************************************************************
 */
export async function typePlayChangeHandler(form: BroadcastsSettings): Promise<void> {

    // Устанавливаем элементы
    let typePlay = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="type-play"]:checked`);

    try {

        // Сессия пользователя
        let session = LocalStorage.session;
        if (session) {
            session.settings.broadcasts.type_play = typePlay?.value || "flv";
            LocalStorage.updateSession(session);
        }

    } catch (error) {
        Logger.error(error);
    }

}
