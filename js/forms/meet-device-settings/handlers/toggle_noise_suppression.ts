// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { applyNoiseSuppression } from "../../meet-play/functions/apply_noise_suppression.js";
import { saveNoiseSuppression } from "../../meet-play/functions/noise_suppression_storage.js";

// Импортируем типы
import type { MeetDeviceSettings } from "../index.js";

/**
 * ***************************************************************************
 * toggleNoiseSuppressionHandler - Переключает шумоподавление в форме
 *                                 устройств.
 *
 * Настройка сохраняется всегда - даже при выключенном микрофоне:
 * применится при следующем включении источника (см. `toggle_audio.ts`).
 * Применение к живому треку идёт сразу, если микрофон уже публикуется.
 * @param dialog - Экземпляр формы устройств.
 * @param enabled - Новое состояние тумблера.
 * @returns Промис переключения.
 * ***************************************************************************
 */
export async function toggleNoiseSuppressionHandler(dialog: MeetDeviceSettings, enabled: boolean): Promise<void> {

    try {

        const state = Boolean(enabled);

        // Сначала сохраняем: даже если применение к живому треку
        // не удалось, выбор пользователя не должен потеряться
        saveNoiseSuppression(state);

        // applyNoiseSuppression гасит ошибки сама (с тостом) -
        // здесь останется только сбой самого сохранения.
        // Без открытой конференции применять нечего — настройка сохранена
        // и подхватится при следующем включении микрофона
        const meetPlayForm = dialog.meetPlayForm;
        if (meetPlayForm) {
            await applyNoiseSuppression(meetPlayForm, state);
        }

    } catch (error) {
        Logger.error("🚨 [meet-play][noise]: Ошибка переключения шумоподавления:", error);
    }

}
