// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettings } from "../index.js";

/**
 * ***************************************************************************
 * Выход из сессии (смена аккаунта): очищает текущую сессию и перезагружает
 * страницу. Тост успеха здесь не показываем — exitSession() сразу вызывает
 * window.location.reload(), тост не успеет отобразиться; обратная связь —
 * сама перезагрузка и экран входа.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function exitSessionHandler(form: UserSettings): Promise<void> {

    try {

        // Выходим из сессии
        LocalStorage.exitSession();

        // Закрываем форму
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
