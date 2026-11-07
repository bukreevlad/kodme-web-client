// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { syncStore } from "../../functions/sync_store.js";
import { savePinned } from "../../functions/pinned_storage.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeParticipantDisconnected - Участник вышел из комнаты.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeParticipantDisconnected(form: MeetPlay): void {

    try {

        // Подписываемся на событие - участник отключился
        form.room?.on(RoomEvent.ParticipantDisconnected, (participant) => {

            Logger.debug(`🚪 [LiveKit]: Участник вышел: ${participant.identity}`);

            // ---------- ЗАКРЕПЛЕНИЕ ----------
            // Закреплённый ушёл — закрепление снимаем. Иначе в
            // findFocusIdentity остался бы identity без плитки, фокус
            // ушёл бы на «первого из списка», и пользователь видел бы
            // чужого человека без единого объяснения. Само событие
            // разметку не запускает — её запускает syncStore ниже.
            //
            // При закрытии самой конференции (isClosing) не снимаем:
            // там уходит и сам пользователь, а закрепление хранится в
            // sessionStorage именно ради возврата в конференцию. Если
            // коллега к этому моменту уже не в комнате, закреплённого
            // молча сбросит findFocusIdentity — по отсутствию плитки.
            if (form?.pinnedIdentity === participant?.identity && !form?.isClosing) {
                form.pinnedIdentity = null;
                savePinned(form?.meetId, null);
            }
            // ---------- ЗАКРЕПЛЕНИЕ ----------

            syncStore(form);

        });

    } catch (error) {
        Logger.error(error)
    }

}
