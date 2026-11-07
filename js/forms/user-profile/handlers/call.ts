// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Call } from "../../call/index.js";

// Импортируем типы
import type { UserProfile } from "../index.js";

/**
 * ***************************************************************************
 * Звонок из профиля пользователя.
 *
 * Если у собеседника уже идёт принятый звонок, сервер вольёт этого
 * пользователя в него (групповой звонок) — тогда форма откроется сразу
 * с состоянием «Соединение…», без прозвона.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function callHandler(form: UserProfile): Promise<void> {

    try {

        // Открываем форму звонка (или поднимаем уже открытую)
        let instance = Call.instances.get(form.userId);
        if (instance) {
            instance?.modal?.activate();
        } else {

            // Профиль загружается до открытия формы — без него звонок не откроем
            const profile = form.profile;
            if (!profile) return;
            new Call({
                userId: form.userId,
                isInitiator: true,
                displayName: profile.display_name,
                avatar: profile.avatar
            });
        }

    } catch (error) {
        Logger.error(error);
    }

}
