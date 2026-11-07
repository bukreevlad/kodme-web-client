// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { muteAllParticipantsRequest } from "../requests/mute_all_participants.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import type { MeetBlockFlag } from "../types.js";

/**
 * ***************************************************************************
 * Массовая блокировка (или разблокировка) источника у всех участников
 * конференции.
 *
 * Запрет пишется в ПРАВИЛО КОМНАТЫ, поэтому работает, даже
 * когда в комнате никого нет: подействует на того, кто зайдёт позже.
 * Организатора и трансляции сервер пропускает сам.
 *
 * Передаётся ровно один флаг — тот, который организатор переключил:
 * остальные сервер не трогает, иначе одно массовое действие стирало бы
 * решения по другим источникам.
 * @param form - Экземпляр формы.
 * @param flag - Что меняем: "audio" | "video" | "screen".
 * @param blocked - true — запретить, false — разрешить.
 * @returns Промис массового действия.
 * ***************************************************************************
 */
export async function muteAllParticipantsHandler(
    form: MeetPlay,
    flag: MeetBlockFlag,
    blocked = true
): Promise<void> {

    // Без флага запрос не изменил бы ни одного флага, и сервер
    // ответил бы NOTHING_TO_CHANGE — лучше не отправлять его вовсе
    if (!flag) {
        Logger.warn("[meet-play][mute-all]: Не указан флаг, действие пропущено");
        return;
    }

    try {

        // Флаг `undefined` означал бы для сервера «сохранить как есть»,
        // поэтому итоговое значение передаём явно: массовое действие
        // переключает выбранный источник у всех участников.
        const response = await muteAllParticipantsRequest({
            meet_id: form.meetId,
            blocks: { [flag]: blocked === true }
        });

        // Проверка запроса
        if (response?.status) {

            // Toast: текст зависитит от источника — раньше один ключ
            // «про микрофон» показывался и для камер, и для демонстрации
            Toast.success(blocked
                ? window._lc.forms.meet_play.toasts[`success_mute_all_${flag}`]
                : window._lc.forms.meet_play.toasts[`success_unmute_all_${flag}`]);

        }

    } catch (error) {
        Logger.error("[meet-play][mute-all]: Ошибка при массовой блокировке:", error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // ---------- УЧАСТНИКИ ----------
        // Состояние уже совпадает с запрошенным: правило комнаты и все
        // точечные отступления уже такие
        if (String((error as Error)?.message).includes("NOTHING_TO_CHANGE")) {

            Toast.error(window._lc.forms.meet_play.toasts.nothing_to_change);
            isToastShown = true;
        }
        // ---------- УЧАСТНИКИ ----------

        // ---------- ДОСТУП ----------
        // Модерация доступна только создателю конференции
        if (String((error as Error)?.message).includes("ACCESS_DENIED")) {

            Toast.error(window._lc.forms.meet_play.toasts.access_denied);
            isToastShown = true;
        }
        // ---------- ДОСТУП ----------

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(window._lc.forms.meet_play.toasts.mute_all_error);
        }

    }

}
