// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем requests
import { removeParticipantRequest } from "../requests/remove_participant.js";

// Импортируем functions
import { isCastIdentity } from "../../functions/parse_room_state.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";
import type { Participant, RemoteParticipant } from "livekit-client";

/**
 * ***************************************************************************
 * removeParticipantHandler - Исключение участника конференции.
 *
 * Трансляции (`cast-<cast_id>`) сервер снимает сам, разбирая identity,
 * поэтому отдельного запроса для них не требуется.
 * @param form - Экземпляр формы.
 * @param participant - Участник LiveKit.
 * @returns Промис исключения участника.
 * ***************************************************************************
 */
export async function removeParticipantHandler(
    form: MeetPlay,
    participant: Participant | RemoteParticipant | null | undefined
): Promise<void> {

    // Идентификатор участника в комнате LiveKit
    const identity = participant?.identity;

    // Если участника нет — показывать ошибку не о чем
    if (!identity) {
        Logger.warn("[meet-play][remove]: Участник без identity, удаление пропущено");
        return;
    }

    // Трансляция это или живой участник: от этого зависит текст тоста
    const isCast = isCastIdentity(identity);

    try {

        // Запрос
        const response = await removeParticipantRequest({
            meet_id: form.meetId,
            participant_id: identity
        });

        // Проверка запроса
        if (response?.status) {

            // Toast
            Toast.success(isCast
                ? window._lc.forms.meet_play.toasts.success_remove_ingress
                : window._lc.forms.meet_play.toasts.success_remove);

        }

    } catch (error) {
        Logger.error("[meet-play][remove]: Ошибка при удалении:", error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // ---------- УЧАСТНИК ----------
        // Участника нет в комнате: он вышел сам, пока организатор нажимал кнопку
        if (String((error as Error)?.message).includes("PARTICIPANT_NOT_FOUND")) {

            Toast.error(window._lc.forms.meet_play.toasts.participant_not_found);
            isToastShown = true;
        }

        // Организатора исключить нельзя
        if (String((error as Error)?.message).includes("CANNOT_REMOVE_OWNER")) {

            Toast.error(window._lc.forms.meet_play.toasts.cannot_remove_owner);
            isToastShown = true;
        }
        // ---------- УЧАСТНИК ----------

        // ---------- ДОСТУП ----------
        // Модерация доступна только создателю конференции
        if (String((error as Error)?.message).includes("ACCESS_DENIED")) {

            Toast.error(window._lc.forms.meet_play.toasts.access_denied);
            isToastShown = true;
        }
        // ---------- ДОСТУП ----------

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(isCast
                ? window._lc.forms.meet_play.toasts.remove_ingress_error
                : window._lc.forms.meet_play.toasts.remove_error);
        }

    }

}
