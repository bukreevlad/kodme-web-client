// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../../core/managers/secret_calls_manager.js";

// Импортируем functions
import { endReasonLabel, renderCallState } from "../functions/render_state.js";

// Импортируем типы
import type { SecretCall } from "../index.js";

/**
 * ***************************************************************************
 * subscribeManagerEvents - подписка формы на события SecretCallsManager:
 * состояние звонка, медиапотоки и завершение.
 * @param form - Экземпляр формы.
 * @returns Функция отписки от всех событий менеджера.
 * ***************************************************************************
 */
export function subscribeManagerEvents(form: SecretCall): () => void {

    // Менеджер создаётся вместе с home — без него подписываться не на что
    const manager = SecretCallsManager.instance;
    if (!manager) return () => { };

    // Подписки (все отписки собираем в массив)
    const unsubs = [

        // Состояние звонка (финал рендерит событие call::ended — с причиной)
        manager.on("call::state", ({ callId, state }) => {
            if (callId !== form.callId || state === "ended") return;
            renderCallState(form, state);
        }),

        // Локальный поток: своё видео в угловой плашке
        manager.on("call::local-stream", ({ callId, stream }) => {
            if (callId !== form.callId) return;
            const video = form.tpl?.querySelector<HTMLVideoElement>(":scope [data-self-video]");
            if (video) video.srcObject = stream;
        }),

        // Удалённый поток: видео собеседника на сцене
        manager.on("call::remote-stream", ({ callId, stream }) => {
            if (callId !== form.callId) return;
            const video = form.tpl?.querySelector<HTMLVideoElement>(":scope [data-peer-video]");
            if (video) video.srcObject = stream;
        }),

        // Звонок завершён: показываем причину и закрываем форму
        manager.on("call::ended", ({ callId, reason }) => {
            if (callId !== form.callId) return;
            renderCallState(form, "ended", endReasonLabel(reason));
        })

    ];

    // Объединённая отписка
    return () => {
        for (const unsubscribe of unsubs) {
            try {
                unsubscribe();
            } catch (error) {
                Logger.error("[app][secret-call][events]::destroy", error);
            }
        }
    };

}
