// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем functions
import { updateStateButtons } from "../../functions/update_state_buttons.js";

// Импортируем типы
import type { SecretChatMessageItem } from "../message.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * removeTemporaryMessageHandler - удаление черновика (вложения до отправки)
 * из списка и с формы.
 * @param message - Родительское сообщение (черновик).
 * ***************************************************************************
 */
export async function removeTemporaryMessageHandler(message: SecretChatMessageItem): Promise<void> {

    try {

        message.form.store.remove(message.data.id);
        message.form.tempMessage = null;
        updateStateButtons(message.form);
        Toast.success(t("forms.secret_chat.toasts.message_removed"), { position: "bottom-center" });

    } catch (error) {
        Logger.error(error);
    }

}
