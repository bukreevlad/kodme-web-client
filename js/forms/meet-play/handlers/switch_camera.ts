// Импортируем сторонние пакеты
import { Track } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { updateParticipant } from "../functions/update_participant.js";
import { resolveStateBlocks } from "../functions/parse_room_state.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import type { MeetTriggerEvent } from "../types.js";

/**
 * ***************************************************************************
 * Переключение между передней и задней камерой (user / environment).
 * @param event - Событие нажатия (нужна остановка всплытия).
 * @param form - Экземпляр формы.
 * @returns Промис переключения.
 * ***************************************************************************
 */
export async function switchCameraHandler(event: MeetTriggerEvent, form: MeetPlay): Promise<void> {

    try {
        event?.stopPropagation?.();

        const participant = form.room?.localParticipant;
        if (!participant) return;

        // ---------- ЗАПРЕТ ----------
        // Проверка живёт здесь, а не только на кнопке футера: кнопка
        // при запрете `disabled`, но полагаться на её недостижимость
        // ненадёжно — любой новый вызов обходил бы блокировку. Без
        // проверки запрещённый источник переключился бы в обход
        // запрета организатора.
        if (resolveStateBlocks(form.roomState, participant.identity).video === true) {

            Toast.warning(window._lc.forms.meet_play.blocked_by_organizer);

            return;

        }
        // ---------- ЗАПРЕТ ----------

        const currentFacing = form.videoSettings?.facingMode || "user";
        const targetFacing = currentFacing === "user" ? "environment" : "user";

        if (!form.videoSettings) form.videoSettings = { facingMode: targetFacing };
        form.videoSettings.facingMode = targetFacing;

        // Если камера выключена в LiveKit — сохраняем пресет
        if (!participant.isCameraEnabled) {
            Logger.debug(`🔄 [LiveKit]: Камера выключена. Пресет обновлен на ${targetFacing}`);
            return;
        }

        Logger.debug(`🔄 [LiveKit]: Переключение камеры на ${targetFacing}...`);

        // Находим текущую публикацию видеокамеры.
        // Строковый дубль `=== "camera"` не нужен: значение enum
        // Track.Source.Camera и есть "camera"
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
        await new Promise<void>(resolve => setTimeout(resolve, 200));

        // Запрашиваем новый системный MediaStreamTrack через getUserMedia
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: targetFacing } },
            audio: false
        });

        const newMediaTrack = newStream.getVideoTracks()[0];
        if (!newMediaTrack) return;

        // Заменяем системный трек внутри LiveKit LocalVideoTrack без unpublish
        await currentLocalTrack.replaceTrack(newMediaTrack);

        // Обновляем плитку и иконки футера: смена фронтальной/задней камеры
        // не меняет её состояние, но иконка футера всё равно должна
        // следовать за реальным состоянием, а не за ручной правкой
        updateParticipant(form, participant);

        Logger.debug(`✅ [LiveKit]: Камера успешно заменена на ${targetFacing}`);

    } catch (error) {

        Logger.error("❌ [LiveKit]: Ошибка ручной замены камеры:", error);

        Toast.error(window._lc.forms.meet_play.toasts.camera_error);

    }

}
