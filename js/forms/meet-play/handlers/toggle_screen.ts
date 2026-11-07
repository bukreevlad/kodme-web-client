// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { updateParticipant } from "../functions/update_participant.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";

/**
 * ***************************************************************************
 * Включение и выключение демонстрации экрана локального участника.
 * @param form - Экземпляр формы.
 * @returns Промис переключения.
 * ***************************************************************************
 */
export async function toggleScreenHandler(form: MeetPlay): Promise<void> {

    try {

        // Проверяем screenSharing
        const participant = form.room?.localParticipant;
        const willEnableScreen = !participant?.isScreenShareEnabled;

        // Если включаем экран — проверяем камеру
        if (willEnableScreen && participant?.isCameraEnabled) {
            Logger.debug("🔄 [LiveKit]: Авто-выключение камеры перед включением экрана");
            await participant?.setCameraEnabled(false);
        }

        // Переключаем экран. Звук при демонстрации — по настройке из
        // диалога демонстрации: `audio: true` здесь означал, что
        // звук вкладки уезжает слушателям вместе с галочкой в диалоге
        // браузера, а выключить это было нечем. Строгое `!== false` —
        // поле может быть не задано (настройки ни разу не сохраняли),
        // и это равно «звук нужен», как было раньше
        await participant?.setScreenShareEnabled(willEnableScreen, {
            audio: form?.screenSettings?.captureAudio !== false
        });

        // Перерисовываем весь футер: после авто-выключения камеры её иконка
        // устарела, а единый рендер обновит и её, и иконку экрана
        updateParticipant(form, participant);

    } catch (error) {

        Logger.error("Ошибка шаринга экрана:", error);

        Toast.error(window._lc.forms.meet_play.toasts.screen_error);

    }

}
