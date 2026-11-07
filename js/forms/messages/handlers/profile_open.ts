// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { ChannelProfile } from "../../channel-profile/index.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Открыть профиль канала по кнопке в шапке чата.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function profileOpenHandler(form: Messages): Promise<void> {

    try {

        // Открываем форму
        new ChannelProfile({ channelId: form.channelId });

    } catch (error) {
        Logger.error(error);
    }

}
