// Импортируем формы настроек конференции
import { MeetGridSettings } from "../../meet-grid-settings/index.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";

/**
 * ***************************************************************************
 * Открывает форму настроек сетки из кнопки в шапке.
 *
 * Отдельный обработчик, а не строчка в index.ts: правило проекта требует
 * держать в каркасе формы только жизненный цикл, а действия — в папке
 * handlers.
 * @param form - Экземпляр формы MeetPlay.
 * @returns void
 * ***************************************************************************
 */
export function gridSettingsHandler(form: MeetPlay): void {

    if (!form?.meetId) return;

    new MeetGridSettings({ meetId: form.meetId });

}
