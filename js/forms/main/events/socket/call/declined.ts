// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем forms
import { Call } from "../../../../call/index.js";
import { CallIncoming } from "../../../../call-incoming/index.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

/**
 * Нагрузка ws-события отклонения звонка.
 */
interface CallDeclinedPayload {

    /** Id звонка. */
    call_id: string;

}

/**
 * Значение — нагрузка отклонения звонка.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isCallDeclinedPayload(value: unknown): value is CallDeclinedPayload {
    return isRecord(value) && typeof value.call_id === "string";
}

/**
 * ***************************************************************************
 * Подписка на отклонение/отмену звонка: форма звонящего закрывается с
 * предупреждением, форма входящего закрывается молча.
 * ***************************************************************************
 */
export function subscribeCallDeclined(): void {

    // ***************************************************************************
    // SocketEvent
    // ***************************************************************************
    Socket.client.on("[call]: declined", async (data) => {
        Logger.debug("[app][ws]::[call]: declined", data);

        try {

            // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
            if (!isCallDeclinedPayload(data)) return;

            const callId = data?.call_id;

            // ---------- ФОРМА ИСХОДЯЩЕГО ----------
            // Звонок отклонили (последним) или отменили: форма звонящего
            // закрывается с предупреждением
            //
            // Легаси передавало сюда причину "declined": в списке причин
            // формы звонка её нет, а единственное чтение причины
            // (решение, слать ли "[call]: leave") не различает её с
            // дефолтным "hangup" — поэтому причина не передаётся,
            // поведение закрытия остаётся прежним.
            const callForm = Call.instances.get(callId);

            if (callForm) {

                callForm.endCall({
                    toast: window._lc.forms.call.toasts.declined,
                    toastType: "warning"
                });
                return;

            }
            // ---------- ФОРМА ИСХОДЯЩЕГО ----------

            // ---------- ФОРМА ВХОДЯЩЕГО ----------
            // Звонок отменили, пока звонили мне: форма входящего закрывается
            // молча — предупреждение показал бы и так таймер, а здесь вина
            // на стороне звонившего
            const incomingForm = CallIncoming.instances.get(callId);
            incomingForm?.modal?.close();
            // ---------- ФОРМА ВХОДЯЩЕГО ----------

        } catch (error) {
            Logger.error(error);
        }

    });

}
