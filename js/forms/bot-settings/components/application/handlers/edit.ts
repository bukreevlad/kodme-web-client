// Импортируем dialogs
import { EditBotApp } from "../../../../bot-app-edit/index.js";

// Импортируем типы
import type { BotAppRecord } from "../../../types.js";
import type { BotSettings } from "../../../index.js";

/**
 * ***************************************************************************
 * Открытие диалога редактирования приложения бота.
 *
 * @param event - Click event (останавливает всплытие до строки списка).
 * @param form - Экземпляр формы.
 * @param data - Данные приложения.
 * ***************************************************************************
 */
export function editHandler(event: Event, form: BotSettings, data: BotAppRecord): void {

    // Отменяем всплытие, чтобы не открывалось само приложение
    event.stopPropagation();

    // Открываем диалог редактирования приложения
    new EditBotApp({
        botId: form.botId,
        app: data
    });

}
