// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { updateParticipant } from "../functions/update_participant.js";

// Импортируем типы
import type { Call } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Включение и выключение видеокамеры.
 *
 * Звонок стартует только со звуком, поэтому камера включается именно этим
 * действием — кнопкой в футере.
 * @param event - Событие клика.
 * @param form - Экземпляр формы.
 * @returns Промис переключения.
 * ***************************************************************************
 */
export async function toggleVideoHandler(event: Event, form?: Call): Promise<void> {

    try {

        const participant = form?.room?.localParticipant;
        if (!participant) return;

        const isCameraOn = participant.isCameraEnabled;
        const willEnableCamera = !isCameraOn;

        if (willEnableCamera) {
            // Включаем камеру через встроенные средства LiveKit
            const facingMode = form.videoSettings?.facingMode || "user";
            await participant.setCameraEnabled(true, { facingMode });
        } else {
            // Отключаем камеру (LiveKit сам отменит публикацию и остановит трек)
            await participant.setCameraEnabled(false);
        }

        // Плитку и иконки футера обновляет единая функция
        updateParticipant(form, participant);

    } catch (error) {

        Logger.error("❌ [app][call]: Ошибка переключения видео:", error);

        // Toast
        Toast.error(t("forms.call.toasts.camera_error"));

    }

}
