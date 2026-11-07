// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getDeclension } from "../../../utils/string/declensions.js";

// Импортируем functions
import { isCastIdentity } from "./parse_room_state.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";

/**
 * ***************************************************************************
 * Обновляет счётчик участников в шапке конференции.
 *
 * Считаем от живого состояния комнаты, а не от размера хранилища формы:
 * на странице пагинации отображается лишь часть участников, и по стору
 * их число занижалось бы.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function updateParticipantsCount(form: MeetPlay): void {

    try {

        const element = form.tpl?.querySelector(":scope [data-participants-count]");
        if (!element) return;

        // ---------- СЧЁТ ----------
        const total = countParticipants(form);

        // ---------- ФОРМАТ ----------
        const locale = window._lc.forms.meet_play.participants;

        // Один участник — это всегда локальный пользователь: он не мог
        // выйти из собственной конференции, не закрыв форму. Такую
        // подпись прячем целиком — «1 участник» в шапке ничего не
        // сообщает, а место занимает.
        if (total <= 1) {
            element.classList.add("hidden");
            element.textContent = locale.alone;
            return;
        }

        element.classList.remove("hidden");
        const suffix = getDeclension(total, locale.count);
        element.textContent = `${total} ${suffix ?? ""}`.trim();

    } catch (error) {
        Logger.error("🚨 [meet-play]: Не удалось обновить счётчик участников:", error);
    }

}

/**
 * ***************************************************************************
 * Считает участников комнаты вместе с трансляциями.
 *
 * Трансляции (`cast-*`) живут в `remoteParticipants` наравне с людьми,
 * но в счётчике «участников» им не место: это не люди, и зритель
 * смотрел бы на «3 участника», из которых один — эфир.
 * @param form - Экземпляр формы.
 * @returns Количество людей в комнате.
 * ***************************************************************************
 */
export function countParticipants(form: MeetPlay): number {

    const local = form.room?.localParticipant;
    const remotes = form.room?.remoteParticipants;
    if (!local || !remotes) return 0;

    // ---------- ТРАНСЛЯЦИИ ----------
    let count = 0;
    for (const participant of remotes.values()) {
        if (typeof participant?.identity !== "string") continue;
        if (isCastIdentity(participant.identity)) continue;
        count++;
    }
    // ---------- ТРАНСЛЯЦИИ ----------

    return count + 1;

}
