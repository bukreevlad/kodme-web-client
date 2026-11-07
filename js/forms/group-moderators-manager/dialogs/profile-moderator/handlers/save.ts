// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем requests
import { saveModeratorRequest } from "../requests/save.js";

// Импортируем типы
import type { GroupProfileModerator } from "../index.js";
import { t } from "../../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Сохранение настроек модератора: читает флаги переключателей диалога,
 * отправляет запрос и по успеху закрывает диалог с тостом.
 * @param form - Форма.
 * @returns true, если запрос обработан (и успех, и ошибка — с тостом).
 * ***************************************************************************
 */
export async function saveModeratorHandler(form: GroupProfileModerator): Promise<boolean | void> {

    try {

        // Элементы заполняются из шаблона — без него сохранять нечего
        const tpl = form.tpl;
        if (!tpl) return;

        // Устанавливаем элементы
        let canDeletedMessage = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="can-deleted-message"]`);
        let canCleanMessages = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="can-clean-messages"]`);
        let canRestrictMembers = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="can-restrict-members"]`);

        // Профиль и переключатели обязаны быть — иначе сохранять нечего
        const profile = form.profile;
        if (!profile || !canDeletedMessage || !canCleanMessages || !canRestrictMembers) return;

        // Делаем запрос на сервер
        let response = await saveModeratorRequest({
            channel_id: form.channelId,
            user_id: profile.id,
            can_deleted_message: canDeletedMessage.checked,
            can_clean_messages: canCleanMessages.checked,
            can_restrict_members: canRestrictMembers.checked,
            can_invite_users: false,
            can_pin_messages: false,
        });

        // Проверка ответа
        if (response.status) {

            // Закрываем форму
            form.modal?.close();

            // Отображаем сообщение
            Toast.success(t("forms.group_moderator_profile.toasts.success_save"));

        }

        return true;

    } catch (error) {
        Logger.error(error);

        // Прочая ошибка сервера: без тоста пользователь не узнал бы,
        // что настройки не сохранились
        Toast.error(t("api.errors.server_error"));
    }

}
