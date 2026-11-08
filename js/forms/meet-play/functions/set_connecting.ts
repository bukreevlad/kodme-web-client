// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Показывает или прячет состояние «подключение к конференции».
 *
 * Пока комната не создана, сетка участников пуста. Оставлять пользователя
 * с пустым экраном и работающими кнопками микрофона нельзя: он решит,
 * что интерфейс сломан, и уйдёт из конференции, не дождавшись. Поэтому
 * на время подключения сетку перекрывает оверлей с живым текстом и
 * возможностью отменить.
 *
 * @param form - Экземпляр формы.
 * @param isConnecting - Идёт ли подключение.
 * @returns void
 * ***************************************************************************
 */
export function setConnecting(form: MeetPlay, isConnecting: boolean): void {

    try {

        form.isConnecting = Boolean(isConnecting);

        // ---------- ОВЕРЛЕЙ ----------
        const overlay = form.tpl?.querySelector(":scope >.content [data-connecting]");
        overlay?.classList.toggle("hidden", !isConnecting);

        // ---------- ПОДПИСЬ ----------
        const label = overlay?.querySelector(":scope [data-connecting-text]");
        if (label && isConnecting) label.textContent = t("forms.meet_play.connecting");

    } catch (error) {
        Logger.debug("🚨 [meet-play]: Не удалось переключить состояние подключения:", error);
    }

}
