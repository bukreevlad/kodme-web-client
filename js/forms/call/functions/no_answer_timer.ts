// Импортируем config
import { CALL_NO_ANSWER_TIMEOUT } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { formatDuration } from "./start_timer.js";

// Импортируем типы
import type { Call } from "../index.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Отсчитывает время ожидания ответа на исходящий звонок.
 *
 * За CALL_NO_ANSWER_TIMEOUT секунд звонок закрывается с сообщением
 * «Абонент не ответил»; у приглашённого свой такой же таймер закрывает
 * входящий звонок. Оставшиеся секунды показываются в оверлее вызова.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function startNoAnswerTimer(form: Call): void {

    try {

        // Повторный запуск не нужен
        if (form?.noAnswerTimer) return;

        const deadline = Date.now() + CALL_NO_ANSWER_TIMEOUT;
        const locale = I18n.tree.forms.call;

        const tick = () => {

            const left = Math.max(0, deadline - Date.now());

            // Отсчёт в оверлее вызова
            const element = form.tpl?.querySelector<HTMLElement>(":scope >.content [data-overlay-timer]");
            if (element) element.textContent = formatDuration(Math.ceil(left / 1000));

            // Время вышло — завершаем звонок
            if (left > 0) return;

            stopNoAnswerTimer(form);

            form.endCall({
                reason: "no_answer",
                toast: locale.toasts.no_answer,
                toastType: "warning"
            });

        };

        // Первый тик сразу, чтобы оверлей не пустовал до первой секунды
        tick();
        form.noAnswerTimer = setInterval(tick, 250);

    } catch (error) {
        Logger.error("🚨 [app][call]: Не удалось запустить таймер ожидания ответа:", error);
    }

}

/**
 * ***************************************************************************
 * Останавливает таймер ожидания ответа.
 *
 * Вызывается и при ответе собеседника (звонок состоялся), и при закрытии
 * формы: работающий таймер иначе закрыл бы уже открывшийся звонок заново.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function stopNoAnswerTimer(form: Call): void {

    if (!form?.noAnswerTimer) return;
    clearInterval(form.noAnswerTimer);
    form.noAnswerTimer = null;

}
