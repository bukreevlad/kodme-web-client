// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { updateParticipant } from "../functions/update_participant.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Включение и выключение микрофона локального участника.
 * @param event - Событие клика.
 * @param form - Экземпляр формы.
 * @returns Промис переключения.
 * ***************************************************************************
 */
export async function toggleAudioHandler(event: Event, form: Call): Promise<void> {

    try {

        // Устанавливаем параметры
        const participant = form.room.localParticipant;

        // Проверяем микрофон
        const enabled = !participant.isMicrophoneEnabled;
        Logger.debug(`🎙️ [app][call]: Переключение микрофона -> ${enabled}`);

        // Отправляем информацию
        await participant.setMicrophoneEnabled(enabled, {
            noiseSuppression: true,  // Включает базовое шумоподавление
            echoCancellation: true,  // Включает эхоподавление
            autoGainControl: true    // Включает авторегулировку громкости
        });

        // Плитку и иконки футера обновляет единая функция: состояние
        // трека может изменить не только нажатие (например, сервер),
        // и кнопка обязана следовать за реальностью
        updateParticipant(form, participant);

    } catch (error) {

        Logger.error("🚨 [app][call]: Ошибка переключения аудио:", error);

        // Toast
        Toast.error(window._lc.forms.call.toasts.mic_error);

    }

}
