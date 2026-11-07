// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем forms
import { UserProfile } from "../../user-profile/index.js";

// Импортируем типы
import type { SessionProfile } from "../types.js";
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Открытие профиля текущего пользователя.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function profileHandler(form: Menu): Promise<void> {

    try {

        // invariant: профиль текущей сессии приходит с сервера в
        // фиксированном виде (см. ответ auth/check) — читаем id этим
        // сужением unknown
        const user = LocalStorage.session?.user as SessionProfile | undefined;

        // Без id профиль открывать не по чему (сессия до первой проверки)
        if (!user?.id) return;

        // Открываем форму
        new UserProfile({
            userId: user.id
        });

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
