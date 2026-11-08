// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { updateParticipant } from "../functions/update_participant.js";
import { isHandRaised, withHandRaised } from "../functions/parse_participant.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Поднимает и опускает руку локального участника.
 *
 * Состояние едет в `participant.metadata`, поэтому остальным участникам
 * оно прилетает событием `RoomEvent.ParticipantMetadataChanged` — ни
 * одного запроса на сервер, и это не зависит от того, создатель
 * конференции участник или нет.
 *
 * Метаданные меняются через `setMetadata`, который ЗАМЕНЯЕТ строку целиком,
 * поэтому новую строку собираем слиянием (withHandRaised): прямая перезапись
 * затёрла бы остальные поля участника.
 * @param form - Экземпляр формы.
 * @returns Промис переключения.
 * ***************************************************************************
 */
export async function toggleHandHandler(form: MeetPlay): Promise<void> {

    try {

        // ---------- УЧАСТНИК ----------
        // Без подключения к комнате поднять руку некуда
        const participant = form.room?.localParticipant;
        if (!participant) return;
        // ---------- УЧАСТНИК ----------

        // ---------- ПЕРЕКЛЮЧЕНИЕ ----------
        const raised = !isHandRaised(participant);
        Logger.debug(`✋ [LiveKit]: Поднятие руки -> ${raised}`);

        await participant.setMetadata(withHandRaised(participant.metadata, raised));
        // ---------- ПЕРЕКЛЮЧЕНИЕ ----------

        // Плитку и иконку футера перерисовываем сами, не дожидаясь
        // события от сервера: иначе между нажатием и ответом LiveKit
        // кнопка секунду выглядела бы ненажатой
        updateParticipant(form, participant);

    } catch (error) {

        Logger.error("Ошибка поднятия руки:", error);

        Toast.error(t("forms.meet_play.toasts.hand_error"));

    }

}
