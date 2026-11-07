// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { applyViewMode } from "../functions/apply_view_mode.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Возвращает раскладку звонка в сетку.
 *
 * Кнопка появляется только в режиме фокуса (3+ участника, один на сцене).
 * Снять сцену с участника нельзя кликом по нему же: крупная плитка занята
 * иммерсивным режимом (тап прячет панели), поэтому возврат — только здесь.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function backToGridHandler(form: Call): void {

    try {

        // Сцены нет — раскладка вернётся в сетку автоматически
        form.stageIdentity = null;

        applyViewMode(form);

    } catch (error) {
        Logger.error("🚨 [app][call]: Не удалось вернуться в сетку", error);
    }

}
