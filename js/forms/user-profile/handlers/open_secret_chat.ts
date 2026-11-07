// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";
import { secretChatsTable } from "../../../utils/secret_chats/secret_chats_db.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { SecretChat } from "../../secret-chat/index.js";
import { UserIsNotContact } from "../dialogs/user_is_not_contact.js";

// Импортируем типы
import type { UserProfile } from "../index.js";

/**
 * ***************************************************************************
 * Открыть или создать секретный чат из профиля пользователя: существующий
 * чат открывается (непринятое приглашение уходит повторно), новое приглашение
 * рассылается на все онлайн-устройства собеседника — чат привязывается к
 * устройству, которое его примет (модалка приглашения). Без контакта
 * показывается подсказка — presence-видимость устройств доступна только
 * контактам.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после открытия формы чата.
 * ***************************************************************************
 */
export async function openSecretChatHandler(form: UserProfile): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Профиль загружается до открытия формы — без него делать нечего
        const profile = form.profile;
        if (!profile) return;

        // Менеджер секретных чатов должен быть инициализирован (создаётся вместе с home)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Секретный чат требует контакта: presence-видимость устройств
        // собеседника доступна только контактам
        if (!profile.is_contact) {
            new UserIsNotContact();
            return;
        }

        // Уже есть чат с этим пользователем — открываем его; приглашение
        // (если чат ещё не принят собеседником) отправляем повторно
        const existing = await secretChatsTable().where("peer_user_id").equals(form.userId).first();
        if (existing) {

            await manager.retryInvite(existing.id).catch((error) => {
                Logger.debug("[app][user-profile][secret-chat]: повторное приглашение не ушло:", error);
            });

            // Закрываем профиль и открываем форму секретного чата
            form.modal?.close();
            new SecretChat({ chatId: existing.id });
            return;

        }

        // Приглашение уходит всем онлайн-устройствам собеседника —
        // примет то устройство, которое он выберет (модалка приглашения)
        const chatId = await manager.createChat(form.userId, null);

        // Собеседник офлайн: его устройства не видны, создать чат не по чему
        if (!chatId) {
            Toast.warning(window._lc.forms.secret_chat.toasts.peer_offline, { position: "bottom-center" });
            return;
        }

        // Закрываем профиль и открываем форму секретного чата
        form.modal?.close();
        new SecretChat({ chatId });

    } catch (error) {

        // Пользователь должен понимать, что произошло
        toastError(error, { context: "[app][user-profile][secret-chat]" });

    }

}
