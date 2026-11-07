// Импортируем сторонние пакеты
import { Track } from "livekit-client";
import type { LocalParticipant } from "livekit-client";

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
 * Переключение между передней и задней камерой (user / environment).
 *
 * В звонке запретов организатора нет, поэтому проверка здесь одна:
 * если камера выключена, просто запоминаем выбранное направление —
 * оно применится при следующем включении.
 * @param event - Событие клика.
 * @param form - Экземпляр формы.
 * @returns Промис переключения.
 * ***************************************************************************
 */
export async function switchCameraHandler(event: Event, form?: Call): Promise<void> {

    try {
        event?.stopPropagation();

        const participant: LocalParticipant | undefined = form?.room?.localParticipant;
        if (!form || !participant) return;

        const currentFacing = form.videoSettings?.facingMode || "user";
        const targetFacing = currentFacing === "user" ? "environment" : "user";

        if (!form.videoSettings) form.videoSettings = {};
        form.videoSettings.facingMode = targetFacing;

        // Если камера выключена в LiveKit — сохраняем пресет
        if (!participant.isCameraEnabled) {
            Logger.debug(`🔄 [app][call]: Камера выключена. Пресет обновлён на ${targetFacing}`);
            return;
        }

        Logger.debug(`🔄 [app][call]: Переключение камеры на ${targetFacing}...`);

        // Находим текущую публикацию видеокамеры
        // (значение enum Track.Source.Camera === "camera")
        const trackPublication = Array.from(participant.videoTrackPublications.values()).find(
            pub => pub.source === Track.Source.Camera
        );

        const currentLocalTrack = trackPublication?.track; // Это инстанс LocalVideoTrack

        // Если трека почему-то нет в публикации, включаем штатно
        if (!currentLocalTrack) {
            await participant.setCameraEnabled(true, { facingMode: targetFacing });
            return;
        }

        // Останавливаем системный MediaStreamTrack и освобождаем железо
        const mediaStreamTrack = currentLocalTrack.mediaStreamTrack;
        if (mediaStreamTrack) {
            mediaStreamTrack.stop();
        }

        // Пауза для Camera HAL (Android)
        await new Promise(resolve => setTimeout(resolve, 200));

        // Запрашиваем новый системный MediaStreamTrack через getUserMedia
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: targetFacing } },
            audio: false
        });

        const newMediaTrack = newStream.getVideoTracks()[0];
        if (!newMediaTrack) return;

        // Заменяем системный трек внутри LiveKit LocalVideoTrack без unpublish
        await currentLocalTrack.replaceTrack(newMediaTrack);

        // Плитку и иконки футера обновляет единая функция
        updateParticipant(form, participant);

        Logger.debug(`✅ [app][call]: Камера успешно заменена на ${targetFacing}`);

    } catch (error) {

        Logger.error("❌ [app][call]: Ошибка ручной замены камеры:", error);

        // Toast
        Toast.error(window._lc.forms.call.toasts.camera_error);

    }

}
