// Импортируем сторонние пакеты
import { v7 as Uuidv7 } from "uuid";

// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { IndexedDB } from "../../../utils/indexed_db.js";
import { cleanStoreData } from "../../../utils/helpers/clean_store_data.js";
import { canSend } from "../../../utils/validation/message_validator.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем config
import { TEMP_MESSAGE } from "../../../config/constants.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { sendingMessages } from "../functions/sending_messages.js";
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";
import { firstLoadMessages } from "../functions/first_load_messages.js";

// Импортируем типы
import type { MessageRecord, MessageStoreAddOptions } from "../types.js";
import type { Messages } from "../index.js";
import type { SessionProfile } from "../../menu/types.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создать исходящее сообщение: валидация, оптимистичная pending-запись в
 * IndexedDB и Store, запуск очереди отправки, сброс textarea.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после постановки в очередь.
 * ***************************************************************************
 */
export async function createMessageHandler(form: Messages): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Сессия (без неё отправлять от имени не кого)
        let session = LocalStorage.session;
        if (!session) return;

        // Если канал не найден
        if (!form.channel) return;

        // Получаем текст сообщения (без поля нечего отправлять)
        const textarea = form.textarea;
        if (!textarea) return;

        let text = textarea.value;
        text = text.trim();

        // Проверяем сообщение ДО создания pending-записи.
        const validation = canSend({
            text,
            attachments: form.tempMessage?.attachments
        });

        if (!validation.isValid) {

            // Подсвечиваем поле только для «пустого» текста
            if (validation.code === "empty_message") textarea.classList.add("invalid");

            Toast.warning(I18n.tree.forms.messages.toasts[validation.code], {
                position: "bottom-center"
            });

            return;
        }

        // invariant: user хранится как unknown на границе localStorage; форма читает id/имя
        const sessionUser = session.user as SessionProfile;

        // Создаем временное сообщение
        let message: MessageRecord = {
            ...TEMP_MESSAGE,
            id: form.tempMessage?.id || Uuidv7(),
            created_user_id: sessionUser.id,
            display_name: sessionUser.display_name,
            channel_id: form.channelId,
            channel_type: form.channel.type,
            text: text,
            reply_to_message_id: form.replyMessage ? form.replyMessage.id : null,
            reply_to_message: form.replyMessage ? form.replyMessage : null,
            created_at: new Date().toISOString(),
            is_pending: true,
            attachments: form.tempMessage?.attachments || []
        };

        // Подготавливаем attachments для IndexedDB
        let cleanData = cleanStoreData(message);

        // Вставляем сообщение в IndexedDB (без инициализированной базы
        // пропускаем — отправка идёт из Store формы)
        const db = IndexedDB.db;
        if (db) await db.table("pending_messages").put(cleanData);

        // Сбрасываем данные
        form.tempMessage = null;
        form.replyMessage = null;

        // Очищаем контейнеры (без контейнера нечего чистить)
        if (form.replyContainer) form.replyContainer.innerHTML = "";
        if (form.editContainer) form.editContainer.innerHTML = "";

        // Если сообщения с last_message_id нет в Store — загружаем историю с нуля
        // (она же отобразит неотправленные); иначе вставляем сообщение в Store.
        // Без last_message_id определить «последнее» не по чему — считаем,
        // что оно не найдено
        const lastMessageId = form.channel.last_message_id;
        let lastMessage = lastMessageId != null ? form.store.get(lastMessageId) : undefined;
        if (!lastMessage) {

            // Сбрасываем список и загружаем последние сообщения
            await firstLoadMessages(form);

        } else {

            // Проверяем временное сообщение на форме
            let storeMessage = form.store.get(message.id);

            // Если сообщения нет на форме
            if (!storeMessage) {

                // Отображаем сообщение на форме. Своё сообщение подтягивает
                // список к себе всегда: флаг гасит подписка item::added после
                // синхронизации окна (строка могла быть и не у нижнего края)
                form._stickToBottom = true;

                const addOptions: MessageStoreAddOptions = { direction: "next", ignoreBounds: true };
                form.store.add(message, addOptions);

            }

        }

        // Прокручиваем в самый низ (без менеджера скролла — просто не прокручиваем)
        form.listScrollManager?.scrollToBottom("smooth");

        // Запускаем отправку сообщений
        sendingMessages(form);

        // Сбрасываем textarea
        await resetTextarea(form);

        // Обновляем состояние кнопок
        await updateStateButtons(form);

    } catch (error) {

        // Пользователь должен понимать, что произошло
        toastError(error, { context: "[app][messages][create-message]" });

    }

}
