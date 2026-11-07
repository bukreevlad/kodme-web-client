// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { addCastToMeetRequest } from "../requests/add_cast_to_meet.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import type { MeetCastData } from "../types.js";

/**
 * ***************************************************************************
 * Добавляет выбранную трансляцию (cast) в текущую конференцию.
 * @param form - Экземпляр формы.
 * @param cast - Данные трансляции.
 * @returns Промис добавления.
 * ***************************************************************************
 */
export async function addCastToMeetHandler(form: MeetPlay, cast: MeetCastData): Promise<void> {

    try {

        // Запрос
        const response = await addCastToMeetRequest({
            meet_id: form.meetId,
            cast_id: cast?.id
        });

        // Проверка запроса
        if (response?.status) {
            Toast.success(window._lc.forms.meet_play.toasts.add_cast_success);
        }

    } catch (error) {

        Logger.error("Ошибка при добавлении трансляции:", error);

        Toast.error(window._lc.forms.meet_play.toasts.add_cast_error);

    }

}
