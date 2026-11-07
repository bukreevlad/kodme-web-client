// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем config
import { CALL_NO_ANSWER_TIMEOUT } from "../../../config/constants.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем handlers
import { declineCallHandler } from "../handlers/decline.js";

// Импортируем типы
import type { CallIncoming } from "../index.js";

/**
 * ***************************************************************************
 * Запускает таймер входящего звонка.
 *
 * Если пользователь не ответил за CALL_NO_ANSWER_TIMEOUT, форма закрывается
 * сама и отправляет серверу `[call]: decline` c причиной "timeout" — иначе
 * вызов «висит» у обоих участников, пока кто-то не закроет вкладку.
 * Оставшееся время показывается в строке статуса.
 * @param form - Экземпляр формы CallIncoming.
 * ***************************************************************************
 */
export function startRingTimer(form: CallIncoming): void {

    try {

        // Запускаем только один раз
        if (form.ringTimer) return;

        // Всего секунд на ответ
        let total = Math.round(CALL_NO_ANSWER_TIMEOUT / 1000);
        let left = total;

        // Счётчик обратного отсчёта
        form.ringTimer = setInterval(() => {

            left--;

            // Показываем оставшееся время в статусе
            if (left > 0) {
                const subtitle = form.tpl?.querySelector<HTMLElement>(":scope >.content [data-subtitle]");
                if (subtitle) {
                    const minutes = String(Math.floor(left / 60)).padStart(2, "0");
                    const seconds = String(left % 60).padStart(2, "0");
                    subtitle.textContent = `${window._lc.forms.call.status.ringing} ${minutes}:${seconds}`;
                }
                return;
            }

            // Время вышло — сообщаем пользователю и отклоняем вызов
            Toast.warning(window._lc.forms.call_incoming.toasts.no_answer, {
                position: "top-center"
            });

            declineCallHandler(form, { isAuto: true, reason: "timeout" });

        }, 1000);

    } catch (error) {
        Logger.error("🚨 [app][call-incoming]: Ошибка при запуске таймера вызова", error);
    }

}

/**
 * ***************************************************************************
 * Останавливает таймер входящего вызова.
 * @param form - Экземпляр формы CallIncoming.
 * ***************************************************************************
 */
export function stopRingTimer(form: CallIncoming): void {

    try {

        if (!form?.ringTimer) return;
        clearInterval(form.ringTimer);
        form.ringTimer = null;

    } catch (error) {
        Logger.error("🚨 [app][call-incoming]: Ошибка при остановке таймера вызова", error);
    }

}
