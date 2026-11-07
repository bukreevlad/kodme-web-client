// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение флага размытия интерфейса.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function isBlurHandler(form: UserSettingDecorations): Promise<void> {

    // Устанавливаем элементы
    const isBlur = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="is-blur-enabled"]`);

    try {

        // Обновляем данные в сессии
        const session = LocalStorage.session;
        if (session) {
            // Флаг настройки: нет чекбокса в шаблоне ⇒ не отмечен
            session.settings.user.decorations.blur = isBlur?.checked ?? false;
            LocalStorage.updateSession(session);
        }

    } catch (error) {
        Logger.error(error);
    }

}
