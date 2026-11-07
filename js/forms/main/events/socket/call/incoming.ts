// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { ElectronNotifications } from "../../../../../utils/electron_notifications.js";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем forms
import { Call } from "../../../../call/index.js";
import { CallIncoming } from "../../../../call-incoming/index.js";

// Импортируем типы
import { isRecord } from "../../../types.js";
import { t } from "../../../../../utils/i18n/index.js";

/**
 * Нагрузка ws-события входящего звонка.
 */
interface CallIncomingPayload {

    /** Id звонка. */
    call_id: string;

    /** Id звонившего пользователя. */
    user_id?: string;

    /** Имя звонившего (для тоста о занятости). */
    display_name?: string;

    /** Аватар звонившего (структуру задаёт сервер). */
    avatar?: unknown;

}

/**
 * Значение — нагрузка входящего звонка.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isCallIncomingPayload(value: unknown): value is CallIncomingPayload {
    return isRecord(value) && typeof value.call_id === "string";
}

/**
 * ***************************************************************************
 * Подписка на входящий звонок: открывается форма звонка; если пользователь
 * уже говорит — показывается тост, кто звонил, а дубль (из push-ссылки)
 * отсекается заранее.
 * ***************************************************************************
 */
export function subscribeCallIncoming(): void {

    // ***************************************************************************
    // SocketEvent
    // ***************************************************************************
    Socket.client.on("[call]: incoming", async (data) => {
        Logger.debug("[app][ws]::[call]: incoming", data);

        try {

            // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
            if (!isCallIncomingPayload(data)) return;

            // ---------- УЖЕ ОТКРЫТА ----------
            // Глубокая ссылка из push-уведомления могла открыть эту же форму
            // раньше, чем дошло WS-событие: дубль не нужен, форма уже звонит
            if (CallIncoming.instances.has(data?.call_id)) return;
            // ---------- УЖЕ ОТКРЫТА ----------

            // ---------- ЗАНЯТОСТЬ ----------
            // Пользователь уже говорит по звонку (свой или входящий) —
            // новую форму не открываем, а сообщаем, кто звонил
            if (Call.instances.size > 0 || CallIncoming.instances.size > 0) {

                // Toast
                Toast.warning(
                    t("forms.call.toasts.busy_incoming", { name: data?.display_name || "" }),
                    { position: "top-center" }
                );
                return;

            }
            // ---------- ЗАНЯТОСТЬ ----------

            // Открываем форму входящего звонка
            new CallIncoming({
                callId: data?.call_id,
                userId: data?.user_id,
                displayName: data?.display_name,
                avatar: data?.avatar
            });

            // Нативное уведомление десктоп-обёртки: при неактивном окне
            // звонок «виден» только звуком — клик по уведомлению фокусирует
            // окно и открывает форму звонка
            ElectronNotifications.show({
                title: data?.display_name || "",
                body: t("forms.call_incoming.title"),
                tag: `call-${data.call_id}`,
                url: `/?callId=${encodeURIComponent(data.call_id)}`
                    + (data?.user_id ? `&userId=${encodeURIComponent(data.user_id)}` : "")
            }, "calls");

        } catch (error) {
            Logger.error(error);
        }

    });

}
