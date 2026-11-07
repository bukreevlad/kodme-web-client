// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getDeclension } from "../../../utils/string/declensions.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Обновляет заголовок и счётчик участников в шапке звонка.
 *
 * Счётчик показывается только с трёх участников: подпись «2 участника»
 * в звонке 1-1 дублирует имя собеседника в шапке и ничего не добавляет.
 * Когда звонок вырастает до группы, в шапке меняется и имя — на название
 * группового звонка: «Иван» в звонке с пятью людьми вводит в заблуждение.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function updateParticipantsCount(form: Call): void {

    try {

        const element = form?.tpl?.querySelector<HTMLElement>(":scope >[data-header] [data-participants-count]");
        if (!element) return;

        // ---------- СЧЁТ ----------
        const total = countParticipants(form);

        // ---------- ЗАГОЛОВОК ----------
        const name = form?.tpl?.querySelector<HTMLElement>(":scope >[data-header] [data-name]");
        if (name) {
            const locale = window._lc.forms.call;
            name.textContent = total >= 3
                ? locale.group_title
                : (form.displayName || locale.title);
        }
        // ---------- ЗАГОЛОВОК ----------

        // ---------- ФОРМАТ ----------
        // Меньше трёх — это обычный звонок, счётчик прячем
        if (total < 3) {
            element.classList.add("hidden");
            element.textContent = "";
            return;
        }

        const locale = window._lc.forms.call.participants;
        element.classList.remove("hidden");
        element.textContent = `${total} ${getDeclension(total, locale.count)}`;
        // ---------- ФОРМАТ ----------

    } catch (error) {
        Logger.error("🚨 [app][call]: Не удалось обновить счётчик участников:", error);
    }

}

/**
 * ***************************************************************************
 * Считает участников комнаты звонка (локального + удалённых).
 * @param form - Экземпляр формы.
 * @returns Количество людей в комнате.
 * ***************************************************************************
 */
export function countParticipants(form: Call): number {

    const local = form?.room?.localParticipant;
    const remotes = form?.room?.remoteParticipants;
    if (!local || !remotes) return 0;

    return remotes.size + 1;

}
