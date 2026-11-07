// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { SecretChatsManager } from "../../../../core/managers/secret_chats_manager.js";
import { secretMessagesTable, secretChatsTable } from "../../../../utils/secret_chats/secret_chats_db.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем functions
import { decryptSecretMessage, withResolvedReply, loadSecretFile } from "../../functions/decrypt_message.js";
import { updateFileProgress, clearFileProgress, applyFileBlob, preserveFileBlobs, hydrateMessageFiles } from "../../functions/file_progress.js";
import { MessageList } from "../../functions/message_list.js";
import { renderHeader } from "../../functions/render_header.js";

// Импортируем типы
import type { SecretChatStoreAddOptions } from "../../types.js";
import type { SecretChat } from "../../index.js";
import { I18n, t } from "../../../../utils/i18n/index.js";

/** Время показа статуса активности собеседника («печатает…»), мс. */
const TYPING_TIMEOUT_MS = 3000;

/**
 * ***************************************************************************
 * Подпись статуса активности собеседника из локали.
 * @param status - Статус активности из control-кадра typing.
 * @returns Локализованная подпись («печатает…» и т.п.).
 * ***************************************************************************
 */
function typingLabel(status: string): string {

    const locale = I18n.tree.forms.secret_chat.typing;
    switch (status) {
        case "recording_audio": return locale.recording_audio;
        case "recording_video": return locale.recording_video;
        case "uploading_document": return locale.uploading_document;
        default: return locale.typing;
    }

}

/**
 * ***************************************************************************
 * subscribeManagerEvents - подписка формы на события SecretChatsManager:
 * новые/изменённые/удалённые сообщения переносятся в Store формы, состояние
 * соединения и «печатает…» — в шапку.
 *
 * @param form - Экземпляр формы.
 * @returns Функция отписки от всех событий менеджера.
 * ***************************************************************************
 */
export function subscribeManagerEvents(form: SecretChat): () => void {

    // Менеджер обязан быть инициализирован (создаётся вместе с home)
    const manager = SecretChatsManager.instance;
    if (!manager) return () => { };

    // Таймер сброса статуса активности собеседника
    let typingTimer: ReturnType<typeof setTimeout> | null = null;

    /** Обновление/добавление сообщения в Store из локальной записи. */
    const applyMessage = async (chatId: string, messageId: string): Promise<void> => {

        // События других чатов не касаются этой формы
        if (chatId !== form.chatId) return;

        try {

            // Читаем запись из локальной истории и расшифровываем payload
            const record = await secretMessagesTable().get(messageId);
            if (!record) return;
            const decrypted = await withResolvedReply(form, await decryptSecretMessage(record));

            const existing = form.store.get(messageId);

            // Пересборка из payload несёт только метаданные и миниатюры —
            // расшифрованные оригиналы переносим из прежних вложений,
            // иначе просмотрщик переставал открывать готовые файлы
            decrypted.attachments = preserveFileBlobs(decrypted.attachments, existing?.attachments);

            if (existing) {

                // Точечное обновление (компонент строки перерисуется сам)
                form.store.update(messageId, decrypted);

            } else {

                // Новое сообщение: своё всегда подтягивает список к себе,
                // входящее — только если читатель сидит внизу ленты
                if (decrypted.sender === "me" || MessageList.isLastItemVisible(form)) {
                    form._stickToBottom = true;
                }

                const addOptions: SecretChatStoreAddOptions = { direction: "next" };
                form.store.add(decrypted, addOptions);

                // Страховка от гонки: файл мог завершиться раньше строки —
                // подставляем готовые оригиналы из локального хранения
                hydrateMessageFiles(form, messageId);

            }

        } catch (error) {
            Logger.error("[app][secret-chat][manager-events]: ошибка обновления сообщения:", error);
        }

    };

    // Подписки (все отписки собираем в массив)
    const unsubs = [

        // Новое сообщение (входящее из канала либо своё из очереди)
        manager.on("message::added", ({ chatId, messageId }) => {
            applyMessage(chatId, messageId);
        }),

        // Обновление сообщения (статус доставки, редактирование)
        manager.on("message::updated", ({ chatId, messageId }) => {
            applyMessage(chatId, messageId);
        }),

        // Удаление сообщения (msg_remove от собеседника либо своё)
        manager.on("message::removed", ({ chatId, messageId }) => {
            if (chatId !== form.chatId) return;
            form.store.remove(messageId);
        }),

        // Смена состояния P2P-соединения — подзаголовок шапки
        manager.on("connection::state", ({ chatId, state }) => {
            if (chatId !== form.chatId) return;
            form.connectionState = state;
            renderHeader(form);
        }),

        // Собеседник активен (печатает/записывает) — подзаголовок шапки
        manager.on("typing", ({ chatId, status }) => {
            if (chatId !== form.chatId) return;

            // Статус активности из локали ("печатает…" и т.п.)
            form.typingStatusText = typingLabel(status);
            renderHeader(form);

            // Статус гаснет по таймеру без новых событий
            if (typingTimer) clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                typingTimer = null;
                form.typingStatusText = null;
                renderHeader(form);
            }, TYPING_TIMEOUT_MS);
        }),

        // Обновление чата (self_destruct, verified, статус)
        manager.on("chat::updated", async ({ chatId }) => {
            if (chatId !== form.chatId) return;

            const chat = await secretChatsTable().get(chatId);
            if (!chat) return;
            form.chat = chat;
            renderHeader(form);
        }),

        // Прогресс передачи файла — прогресс-бары вложения строки
        manager.on("file::progress", ({ chatId, fileId, loaded, total }) => {
            if (chatId !== form.chatId) return;
            updateFileProgress(form, fileId, loaded, total);
        }),

        // Файл передан целиком: убираем прогресс, подставляем расшифрованный
        // оригинал — строка перерисовывается фабриками вложений с _file
        manager.on("file::done", ({ chatId, fileId }) => {
            if (chatId !== form.chatId) return;
            clearFileProgress(form, fileId);
            loadSecretFile(fileId).then((loaded) => {
                if (!loaded) return;

                // Запись файла несёт владельца — ищем строку по нему;
                // если сообщение ещё не попало в Store (гонка события),
                // оригинал подставит hydrateMessageFiles при его добавлении
                const messageId = loaded.record.message_id;
                if (form.store.get(messageId)) {
                    applyFileBlob(form, messageId, fileId, loaded.blob);
                }
            }).catch((error) => {
                Logger.error("[app][secret-chat][manager-events]: ошибка расшифровки файла:", error);
            });
        }),

        // Передача файла прервана: убираем прогресс (запись помечена failed)
        manager.on("file::failed", ({ chatId, fileId }) => {
            if (chatId !== form.chatId) return;
            clearFileProgress(form, fileId);
        }),

        // Приглашение закрыто без принятия (все отказали/таймаут) —
        // сообщаем инициатору, у которого открыта форма чата
        manager.on("chat::invite-ended", ({ chatId, reason }) => {
            if (chatId !== form.chatId || reason === "taken" || reason === "cancelled") return;
            Toast.warning(reason === "declined"
                ? t("forms.secret_chat.toasts.invite_declined")
                : t("forms.secret_chat.toasts.invite_timeout"), { position: "bottom-center" });
        })

    ];

    // Объединённая отписка (с таймером активности собеседника)
    return () => {

        if (typingTimer) {
            clearTimeout(typingTimer);
            typingTimer = null;
        }

        for (const unsubscribe of unsubs) {
            try {
                unsubscribe();
            } catch (error) {
                Logger.error("[app][secret-chat][manager-events]::destroy", error);
            }
        }

    };

}
