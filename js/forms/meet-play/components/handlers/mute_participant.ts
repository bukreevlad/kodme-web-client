// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем requests
import { muteParticipantRequest } from "../requests/mute_participant.js";

// Импортируем functions
import { resolveStateBlocks, isCastIdentity } from "../../functions/parse_room_state.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";
import type { MeetBlockFlag } from "../../types.js";
import type { Participant, RemoteParticipant } from "livekit-client";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * muteParticipantHandler - Задаёт блокировку микрофона, камеры и/или
 *           демонстрации экрана одному участнику конференции (жёсткая блокировка).
 *
 * Сервис ждёт **итоговые** флаги, а не дельту: запрещённый источник
 * нельзя вернуть себе самостоятельно, пока организатор не разрешит его
 * явно.
 * @param form - Экземпляр формы.
 * @param participant - Участник LiveKit.
 * @param flag - Что меняем: "audio" | "video" | "screen".
 * @returns Промис блокировки участника.
 * ***************************************************************************
 */
export async function muteParticipantHandler(
    form: MeetPlay,
    participant: Participant | RemoteParticipant | null | undefined,
    flag: MeetBlockFlag
): Promise<void> {

    // Идентификатор участника в комнате LiveKit
    const identity = participant?.identity;

    // Без identity запрос бессмысленен
    if (!identity) {
        Logger.warn("[meet-play][mute]: Участник без identity, блокировка пропущена");
        return;
    }

    // Трансляции блокировать нечем: у неё нет клиента, который мог бы
    // включить источник обратно. Сервер вернёт PARTICIPANT_NOT_FOUND,
    // но лучше не отправлять заведомо обречённый запрос.
    if (isCastIdentity(identity)) {
        Logger.warn("[meet-play][mute]: Трансляции блокировать нельзя, действие пропущено");
        return;
    }

    try {

        // Текущее состояние участника — сервис ждёт все три флага
        const current = resolveStateBlocks(form.roomState, identity);

        // Новое состояние: переключаем только выбранный флаг
        const blocks = { ...current, [flag]: !current[flag] };

        // Запрос
        const response = await muteParticipantRequest({
            meet_id: form.meetId,
            participant_id: identity,
            blocks: blocks
        });

        // Проверка запроса
        if (response?.status) {

            // Toast
            Toast.success(blocks[flag]
                ? t("forms.meet_play.toasts.success_block")
                : t("forms.meet_play.toasts.success_unblock"));

        }

    } catch (error) {
        Logger.error("[meet-play][mute]: Ошибка при блокировке участника:", error);

        // Флаг, что тост уже показан
        let isToastShown = false;

        // ---------- УЧАСТНИК ----------
        // Участник вышел из комнаты, пока организатор нажимал кнопку
        if (String((error as Error)?.message).includes("PARTICIPANT_NOT_FOUND")) {

            Toast.error(t("forms.meet_play.toasts.participant_not_found"));
            isToastShown = true;
        }

        // Организатора заблокировать нельзя
        if (String((error as Error)?.message).includes("CANNOT_BLOCK_SELF")) {

            Toast.error(t("forms.meet_play.toasts.cannot_block_self"));
            isToastShown = true;
        }

        // Флаги совпали с текущим состоянием: запрос не изменил ничего
        if (String((error as Error)?.message).includes("NOTHING_TO_CHANGE")) {

            Toast.error(t("forms.meet_play.toasts.nothing_to_change"));
            isToastShown = true;
        }
        // ---------- УЧАСТНИК ----------

        // ---------- ВАЛИДАЦИЯ ----------
        // Клиент отправил флаги, которых сервер не знает
        if (String((error as Error)?.message).includes("INVALID_BLOCKS")) {

            Toast.error(t("forms.meet_play.toasts.mute_error"));
            isToastShown = true;
        }
        // ---------- ВАЛИДАЦИЯ ----------

        // ---------- ДОСТУП ----------
        // Модерация доступна только создателю конференции
        if (String((error as Error)?.message).includes("ACCESS_DENIED")) {

            Toast.error(t("forms.meet_play.toasts.access_denied"));
            isToastShown = true;
        }
        // ---------- ДОСТУП ----------

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("forms.meet_play.toasts.mute_error"));
        }

    }

}
