// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";
import { wipeSecretChatsData } from "../../../utils/secret_chats/secret_chats_db.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";
import { SecretCallsManager } from "../../../core/managers/secret_calls_manager.js";

// Импортируем типы
import type { UserSettings } from "../index.js";

/**
 * ***************************************************************************
 * Полный выход из аккаунта: удаляет сессию, чистит БД и кэш, перезагружает
 * страницу. Секретные чаты живут только внутри сессии — стираются vault-ключ
 * и их зашифрованные данные. Тост успеха здесь не показываем — logOutSession()
 * сразу вызывает
 * window.location.reload(), тост не успеет отобразиться; обратная связь —
 * сама перезагрузка и экран входа.
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export async function logoutSessionHandler(form: UserSettings): Promise<void> {

    try {

        // Секретные чаты живут только внутри сессии: сессия удаляется —
        // гасим менеджеры и стираем vault-ключ с зашифрованными данными
        SecretChatsManager.destroy();
        SecretCallsManager.destroy();
        const sessionId = LocalStorage.sessionId;
        if (sessionId) await wipeSecretChatsData(sessionId);

        // Выходим из сессии полностью
        LocalStorage.logOutSession();

        // Закрываем форму
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
