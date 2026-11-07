// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BroadcastsSettings } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение выбранного действия при глобальном media event
 * (paused / muted) в настройки сессии пользователя.
 * @param form - Экземпляр диалога настроек трансляций.
 * ***************************************************************************
 */
export async function typeGlobalMediaEventChangeHandler(form: BroadcastsSettings): Promise<void> {

    // Устанавливаем элементы
    let typeGlobalMediaEvent = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="type-blobal-media-event"]:checked`);

    try {

        // Сессия пользователя
        let session = LocalStorage.session;
        if (session) {
            session.settings.broadcasts.type_global_media_event = typeGlobalMediaEvent?.value || "muted";
            LocalStorage.updateSession(session);
        }

    } catch (error) {
        Logger.error(error);
    }

}
