// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Call } from "../../call/index.js";

// Импортируем functions
import { stopRingTimer } from "../functions/start_ring_timer.js";

// Импортируем requests
import { acceptCallRequest } from "../requests/accept.js";

// Импортируем типы
import type { CallIncoming } from "../index.js";

/**
 * ***************************************************************************
 * Принимает входящий звонок.
 *
 * Порядок важен: сначала сервер подтверждает вход и выдаёт LiveKit-токен,
 * и только потом закрывается эта форма и открывается форма звонка. Если
 * звонок к этому моменту уже завершили (отменили, истёк таймер), сервер
 * ответит ошибкой — тогда форма просто закрывается с предупреждением.
 * @param form - Форма входящего звонка.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function acceptCallHandler(form: CallIncoming): Promise<void> {

    try {

        // Таймер больше не должен успеть отклонить вызов, пока мы в запросе
        stopRingTimer(form);

        // Запрос на сервер (ответ обёрнут: { data, status, timestamp })
        const response = await acceptCallRequest({ call_id: form.callId });

        // Без токена комната недоступна — принимать звонок бессмысленно
        const token = response?.data?.token || null;
        if (!token) throw new Error("Не получен токен LiveKit");

        // Закрываем форму входящего вызова
        form.modal?.close();

        // Открываем форму звонка с полученным токеном
        new Call({
            callId: form.callId,
            userId: form.userId,
            displayName: form.displayName,
            avatar: form.avatar,
            token: token,
            isInitiator: false
        });

    } catch (error) {

        Logger.error("🚨 [app][call-incoming]: Ошибка принятия звонка:", error);

        // Флаг, что тост уже показан
        let isToastShown = false;
        let message = getErrorMessage(error);

        // ---------- ЗВОНОК ----------
        // Звонок отменили или он уже завершён: входящий просто закрывается
        if (message.includes("NOT_INVITED")) {
            Toast.warning(window._lc.forms.call.toasts.ended, { position: "top-center" });
            isToastShown = true;
        }

        // Я не числится в этом звонке (например, уже вышел)
        if (message.includes("USER_ID_REQUIRED") || message.includes("CALL_ID_REQUIRED")) {
            Toast.warning(window._lc.forms.call.toasts.ended, { position: "top-center" });
            isToastShown = true;
        }
        // ---------- ЗВОНОК ----------

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.forms.call_incoming.toasts.accept_error, { position: "top-center" });
        }

        // Форма входящего в любом случае закрывается
        form.modal?.close();

    }

}
