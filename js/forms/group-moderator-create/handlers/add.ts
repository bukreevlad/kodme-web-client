// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { addModeratorRequest } from "../requests/add.js";

// Импортируем типы
import type { GroupAddModerator } from "../index.js";

/**
 * ***************************************************************************
 * Добавление модератора в группу: читает флаги переключателей диалога,
 * отправляет запрос и по успеху закрывает диалог с тостом.
 * @param form - Форма.
 * @returns true, если запрос обработан (и успех, и ошибка — с тостом).
 * ***************************************************************************
 */
export async function addModeratorHandler(form: GroupAddModerator): Promise<boolean | void> {

    try {

        // Устанавливаем элементы
        let canDeletedMessage = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="can-deleted-message"]`);
        let canCleanMessages = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="can-clean-messages"]`);
        let canRestrictMembers = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="can-restrict-members"]`);

        // Делаем запрос на сервер
        let response = await addModeratorRequest({
            channel_id: form.channelId,
            user_id: form.user.id,
            // Чекбокс, которого нет в шаблоне, — то же, что выключенный
            can_deleted_message: canDeletedMessage?.checked ?? false,
            can_clean_messages: canCleanMessages?.checked ?? false,
            can_restrict_members: canRestrictMembers?.checked ?? false,
            can_invite_users: false,
            can_pin_messages: false,
        });

        // Проверка ответа
        if (response.status) {

            // Закрываем форму
            form.modal?.close();

            // Отображаем сообщение
            Toast.success(window._lc.forms.group_moderator_add.toasts.success_add);

        }

        return true;

    } catch (error) {
        Logger.error(error);

        // Прочая ошибка сервера: без тоста пользователь не узнал бы,
        // что модератор не добавился
        Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
    }

}
