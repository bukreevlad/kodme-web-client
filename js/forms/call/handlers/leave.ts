// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Выход из звонка по кнопке в футере или «Отмене» в оверлее.
 *
 * Форма закрывается с причиной hangup: при закрытии она пришлёт
 * `[call]: leave`. Если звонок ещё в статусе ringing, это отменит его
 * целиком — приглашённые получат `[call]: declined` и их форма закроется.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function leaveHandler(form?: Call): void {

    try {

        form?.endCall({ reason: "hangup" });

    } catch (error) {
        Logger.error("[app][call]: Не удалось завершить звонок", error);
    }

}
