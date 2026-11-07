// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { updateParticipant } from "../functions/update_participant.js";
import { applyNoiseSuppression } from "../functions/apply_noise_suppression.js";
import { loadNoiseSuppression } from "../functions/noise_suppression_storage.js";
import { micCaptureOptions } from "../functions/mic_capture_options.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";

/**
 * ***************************************************************************
 * Включение и выключение микрофона локального участника.
 * @param form - Экземпляр формы.
 * @returns Промис переключения.
 * ***************************************************************************
 */
export async function toggleAudioHandler(form: MeetPlay): Promise<void> {

    try {

        // Устанавливаем параметры
        const participant = form.room?.localParticipant;

        // Проверяем микрофон
        const enabled = !participant?.isMicrophoneEnabled;
        Logger.debug(`🎙️ [LiveKit]: Переключение микрофона -> ${enabled}`);

        // Отправляем информацию: опции захвата зависят от шумодава -
        // с включённым гейтом автоусиление выключено (см. micCaptureOptions)
        await participant?.setMicrophoneEnabled(enabled, micCaptureOptions(loadNoiseSuppression()));

        // Плитка и иконки футера обновляет единая функция: она смотрит
        // и на устройство, и на блокировки организатора, поэтому нажатие
        // не может «забыть» про запрет
        updateParticipant(form, participant);

        // Шумоподавление вешаем только после успешного включения и в
        // отдельной try/catch: сбой процессора не должен отменить
        // включение микрофона. Выключение процессор не снимает - LiveKit
        // делает mute(), трек остаётся, и пересборка графа на каждом
        // мьюте давала бы хрип на границах (см. чеклист, п. 5.5)
        if (enabled) {
            try {
                await applyNoiseSuppression(form, loadNoiseSuppression());
            } catch (error) {
                Logger.error("Ошибка применения шумоподавления:", error);
            }
        }

    } catch (error) {

        Logger.error("Ошибка переключения аудио:", error);

        Toast.error(window._lc.forms.meet_play.toasts.mic_error);

    }

}
