// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Decorations } from "../../../utils/decorations.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение режима скругления интерфейса: запись в сессию и применение
 * на лету.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function uiRadiusHandler(form: UserSettingDecorations): Promise<void> {

    // Выбранное скругление
    const uiRadius = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="ui-radius"]:checked`);

    try {

        // Обновляем данные в сессии
        const session = LocalStorage.session;

        // invariant: значение приходит из радиокнопок (compact | default | round)
        if (session) {
            session.settings.user.decorations.ui_radius = (uiRadius?.value as "compact" | "default" | "round") || "default";
            LocalStorage.updateSession(session);
        }

        // Применяем скругления на лету
        Decorations.apply(session);

    } catch (error) {
        Logger.error(error);
    }

}
