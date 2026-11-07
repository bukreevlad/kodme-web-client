// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем requests
import { removeRequest } from "../requests/remove.js";

// Импортируем типы
import type { BotAppRecord } from "../../../types.js";
import type { BotSettings } from "../../../index.js";

/**
 * ***************************************************************************
 * Удаление приложения бота: запрос к API и убрать строку из списка
 * (сам элемент убирает подписка события стора).
 *
 * @param event - Click event (останавливает всплытие до строки списка).
 * @param form - Экземпляр формы.
 * @param data - Данные приложения.
 * ***************************************************************************
 */
export async function removeHandler(event: Event, form: BotSettings, data: BotAppRecord): Promise<void> {

    try {

        // Отменяем всплытие, чтобы не открывалось само приложение
        event.stopPropagation();

        // Запрос
        let response = await removeRequest({ bot_app_id: data.id });

        // Если ответ получен
        if (response.status) {

            // Удаляем запись из хранилища — подписки снимут копии строки
            form.storeApps.remove(data.id);

        }

    } catch (error) {
        Logger.error(error);
    }

}
