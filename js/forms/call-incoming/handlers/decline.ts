// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { stopRingTimer } from "../functions/start_ring_timer.js";

// Импортируем requests
import { declineCallRequest } from "../requests/decline.js";

// Импортируем типы
import type { CallIncoming } from "../index.js";
import type { CallDeclineReason } from "../requests/decline.js";

/**
 * Опции отклонения входящего звонка.
 */
export interface DeclineCallOptions {

    /** Причина: "declined" или "timeout". */
    reason?: CallDeclineReason;

    /** Отклонение по таймауту (без тоста). */
    isAuto?: boolean;

}

/**
 * ***************************************************************************
 * Отклоняет входящий звонок и закрывает форму.
 *
 * Сервер после этого извещает звонящего событием `[call]: declined`; если
 * приглашённых не осталось — звонок финализируется (для 1-1 это системное
 * сообщение о пропущенном звонке).
 * @param form - Форма входящего звонка.
 * @param options - Опции.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function declineCallHandler(form: CallIncoming, options: DeclineCallOptions = {}): Promise<void> {

    try {

        // Таймер останавливаем сразу: иначе он может уйти в запрос повторно
        stopRingTimer(form);

        // Запрос на сервер
        await declineCallRequest({
            call_id: form.callId,
            reason: options.reason || "declined"
        });

    } catch (error) {

        Logger.error("🚨 [app][call-incoming]: Ошибка отклонения звонка:", error);

        // Авто-отклонение по таймеру: пользователь мог не заметить форму,
        // лишний тост в этом случае только раздражает
        if (options.isAuto !== true) {

            // Фолбэк: сервер не различает причины отказа кодами — показываем
            // единственный тост ошибки отклонения
            Toast.error(window._lc.forms.call_incoming.toasts.decline_error, {
                position: "top-center"
            });

        }

    } finally {

        // В любом случае закрываем форму
        form.modal?.close();

    }

}
