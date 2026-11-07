// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { updateParticipant } from "../functions/update_participant.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Включение и выключение видеокамеры локального участника.
 * @param form - Экземпляр формы.
 * @returns Промис переключения.
 * ***************************************************************************
 */
export async function toggleVideoHandler(form: MeetPlay): Promise<void> {

    try {

        const participant = form.room?.localParticipant;
        if (!participant) return;

        const isCameraOn = participant.isCameraEnabled;
        const willEnableCamera = !isCameraOn;

        // Если включаем камеру, автоматически отключаем шеринг экрана
        if (willEnableCamera && participant.isScreenShareEnabled) {
            Logger.debug("🔄 [LiveKit]: Авто-выключение экрана перед включением камеры");
            await participant.setScreenShareEnabled(false);
        }

        if (willEnableCamera) {
            // Включаем камеру через встроенные средства LiveKit
            const facingMode = form.videoSettings?.facingMode || "user";
            await participant.setCameraEnabled(true, { facingMode });
        } else {
            // Отключаем камеру (LiveKit сам отменит публикацию и остановит трек)
            await participant.setCameraEnabled(false);
        }

        // Иконки футера и плитку обновляет единая функция: она смотрит
        // и на устройство, и на блокировки организатора, поэтому
        // авто-выключение экрана выше не оставит его иконку устаревшей
        updateParticipant(form, participant);

    } catch (error) {

        Logger.error("❌ [LiveKit]: Ошибка переключения видео:", error);

        Toast.error(t("forms.meet_play.toasts.camera_error"));

    }

}
