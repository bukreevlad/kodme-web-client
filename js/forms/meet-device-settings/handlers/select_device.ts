// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { renderDevices } from "../functions/render_devices.js";
import { updateParticipant } from "../../meet-play/functions/update_participant.js";

// Импортируем типы
import type { MeetDeviceSettings } from "../index.js";

/**
 * ***************************************************************************
 * selectDeviceHandler - Переключает активное устройство.
 *
 * Меняется **только устройство**, а не состояние источника: если камера
 * была выключена, она и останется выключенной. Это принципиально —
 * иначе выбор микрофона в форме молча включил бы передачу видео, а
 * это в том числе ломает запрет организатора (`permission.canPublishSources`),
 * который держится на «источник не публикуется».
 *
 * Значение и сам LiveKit меняет через `switchActiveDevice`: пока трека
 * нет, он просто запоминает устройство в `videoCaptureDefaults` /
 * `audioCaptureDefaults`, и следующее включение источника возьмёт его.
 * @param dialog - Экземпляр формы устройств.
 * @param kind - `videoinput` или `audioinput`.
 * @param deviceId - Идентификатор устройства.
 * @returns Промис переключения устройства.
 * ***************************************************************************
 */
export async function selectDeviceHandler(
    dialog: MeetDeviceSettings,
    kind: string | undefined,
    deviceId: string | undefined
): Promise<void> {

    try {

        const form = dialog?.meetPlayForm;
        const room = form?.room;
        if (!room) return;

        // Класс устройства приходит из разметки, а не от пользователя:
        // подделанный data-атрибут не должен уйти в LiveKit
        if (kind !== "videoinput" && kind !== "audioinput") return;

        // Устройства без id быть не может, но пустой результат
        // switchActiveDevice в некоторых браузерах трактуется как
        // «включи системное устройство по умолчанию» — молча,
        // и пользователь этого не просил
        if (!deviceId) return;

        // Уже активное — переключать нечего, но перерисовываем:
        // отметка могла разъехаться с реальностью
        if (room.getActiveDevice?.(kind) === deviceId) {
            await renderDevices(dialog);
            return;
        }

        await room.switchActiveDevice(kind, deviceId);

        Logger.debug(`🎛️ [LiveKit]: Активное устройство ${kind} -> ${deviceId}`);

        // Футер и плитка рисуются из реального состояния участника.
        // Сам факт смены устройства её не меняет, но и не должен
        // оставлять иконки в состоянии «до»
        updateParticipant(form, room.localParticipant);

        // Перерисовываем список: отметка активного считается от
        // getActiveDevice, а он обновился только что
        await renderDevices(dialog);

    } catch (error) {

        Logger.error("🚨 [meet-play][devices]: Ошибка переключения устройства:", error);

        Toast.error(window._lc.forms.meet_play.toasts.device_error);

        // Возвращаем список в реальность: неудачное переключение
        // могло оставить отметку на устройстве, которое не работает
        await renderDevices(dialog);

    }

}
