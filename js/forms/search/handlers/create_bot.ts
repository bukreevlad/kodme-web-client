// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем forms
import { BotCreate } from "../../bot-create/index.js";

// Импортируем типы
import type { Search } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Обработчик кнопки «Создать бота» на вкладке поиска.
 *
 * Отличия от прежней версии:
 * - ошибка больше не уходит только в лог: пользователь нажал кнопку и должен
 *   видеть, почему ничего не произошло;
 * - форме создания передаётся `insertInto` формы поиска: иначе BotCreate
 *   искал контейнер сам и мог открыться не там, где ожидает вызывающий.
 *
 * @param form - Экземпляр формы поиска.
 * @returns Promise<void>
 ***************************************************************************
 */
export async function createBotHandler(form: Search): Promise<void> {

    if (!form) return;

    try {

        // Открыть форму создания бота. BotCreate принимает опции плоско
        // ({ insertInto }), без вложенного options
        new BotCreate({
            insertInto: form.options?.insertInto
        });

    } catch (error) {

        Logger.error("[app][search][create-bot]:", error);

        toastError(error, {
            context: "[app][search][create-bot]",
            fallback: t("forms.search.toasts.create_bot_error")
        });

    }

}
