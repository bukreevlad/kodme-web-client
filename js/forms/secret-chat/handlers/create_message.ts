// Импортируем сторонние пакеты
import { v7 as Uuidv7 } from "uuid";

// Импортируем utils
import { canSend } from "../../../utils/validation/message_validator.js";
import { toastError } from "../../../utils/ui/toast_error.js";
import { isKind } from "../../../config/file_types.js";
import * as Attachments from "../../../utils/messages/attachments.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем functions
import { blobToDataUri } from "../functions/build_attaches.js";
import { registerLocalOriginals } from "../functions/file_progress.js";
import { queueFiles, type SecretSendFile } from "../functions/sending_messages.js";
import { resetTextarea } from "../functions/reset_textarea.js";
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем типы
import type { SecretFileRef } from "../../../utils/secret_chats/secret_frames.js";
import type { SecretMessageType } from "../../../types/secret_chats.js";
import type { AttachmentData } from "../../messages/components/types.js";
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * Создать исходящее сообщение: валидация, отправка сообщения (метаданные и
 * миниатюри вложений уходят собеседнику в payload) и постановка файлов в
 * очередь передачи (оригиналы — чанками с прогрессом).
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после постановки сообщения в очередь.
 * ***************************************************************************
 */
export async function createMessageHandler(form: SecretChat): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Если чат не найден
        if (!form.chat) return;

        // Получаем текст сообщения (без поля нечего отправлять)
        const textarea = form.textarea;
        if (!textarea) return;

        let text = textarea.value;
        text = text.trim();

        // Проверяем сообщение ДО постановки в очередь
        const validation = canSend({
            text,
            attachments: form.tempMessage?.attachments
        });

        if (!validation.isValid) {

            // Подсвечиваем поле только для «пустого» текста
            if (validation.code === "empty_message") textarea.classList.add("invalid");

            Toast.warning(window._lc.forms.secret_chat.toasts[validation.code], {
                position: "bottom-center"
            });

            return;
        }

        // Менеджер обязан быть инициализирован (создаётся вместе с home)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Запоминаем ответ до сброса черновика (payload шифруется менеджером)
        const replyTo = form.replyMessage?.id ?? null;

        // Собираем метаданные вложений: они уходят собеседнику в payload
        // (сообщение отображается сразу), оригиналы — следом с прогрессом
        const { refs, files } = await buildFilePayload(form);

        // Локальные оригиналы регистрируем сразу: строка сообщения появляется
        // раньше передачи файлов, и свои вложения открываются без ожидания
        registerLocalOriginals(files);

        // Тип сообщения определяется содержимым (текст/вложение/заметка)
        const msgType = resolveMessageType(refs);

        // Длительность медиа (голосовые/видео-кружки) — в payload сообщения
        const duration = files[0]?.meta.duration ?? null;

        // Сбрасываем данные ответа/редактирования
        form.replyMessage = null;
        form.editedMessage = null;
        if (form.replyContainer) form.replyContainer.innerHTML = "";
        if (form.editContainer) form.editContainer.innerHTML = "";

        // Сообщение попадает в Store через событие message::added менеджера
        const messageId = await manager.sendMessage(form.chatId, msgType, {
            text: text || null,
            reply_to: replyTo,
            duration: duration,
            files: refs.length > 0 ? refs : null
        });

        // Черновик заменён реальной записью — убираем его из Store
        if (form.tempMessage) {
            form.store.remove(form.tempMessage.id);
            form.tempMessage = null;
        }

        // Ставим файлы в очередь передачи (цикл сам ждёт соединения)
        if (files.length > 0) {
            queueFiles(form, { messageId, files });
        }

        // Прокручиваем в самый низ (без менеджера скролла — просто не прокручиваем)
        form.listScrollManager?.scrollToBottom("smooth");

        // Сбрасываем textarea
        await resetTextarea(form);

        // Обновляем состояние кнопок
        await updateStateButtons(form);

    } catch (error) {

        // Пользователь должен понимать, что произошло
        toastError(error, { context: "[app][secret-chat][create-message]" });

    }

}

/**
 * ***************************************************************************
 * Сборка метаданных вложений черновика для payload и очереди передачи.
 * @param form - Экземпляр формы.
 * @returns Метаданные для payload (refs) и файлы для передачи (files).
 * ***************************************************************************
 */
async function buildFilePayload(form: SecretChat): Promise<{ refs: SecretFileRef[]; files: SecretSendFile[] }> {

    const refs: SecretFileRef[] = [];
    const files: SecretSendFile[] = [];

    // Вложения черновика (объект-мап → массив нормализатором)
    for (const attach of Attachments.normalize(form.tempMessage?.attachments ?? [])) {

        // invariant: черновик создаёт import_attaches — у вложения всегда
        // есть локальный файл _file, без него отправлять нечего
        const blob = attach._file;
        if (!(blob instanceof Blob)) continue;

        const fileId = Uuidv7();
        const meta = await buildFileMeta(attach);

        refs.push({ file_id: fileId, ...meta.ref });
        files.push({ fileId, blob, meta: meta.offer });

    }

    return { refs, files };

}

/**
 * ***************************************************************************
 * Метаданные вложения: поля payload (имя, размеры, миниатюра, флаги) и
 * поля file_offer для передачи.
 * @param attach - Вложение черновика.
 * @returns Метаданные для payload и для file_offer.
 * ***************************************************************************
 */
async function buildFileMeta(attach: AttachmentData): Promise<{ ref: Omit<SecretFileRef, "file_id">; offer: SecretSendFile["meta"] }> {

    const metadata = attach.metadata;
    const name = attach.file_name || attach.name || "file";
    const mime = attach.mime_type || "application/octet-stream";
    const size = attach.size ?? 0;

    // Ширина/высота/длительность — из блока original метадаты
    const width = metadata?.original?.width ?? null;
    const height = metadata?.original?.height ?? null;
    const duration = metadata?.original?.duration ?? metadata?.duration ?? null;

    // Миниатюра (самая маленькая) уходит data-URI — сообщение отображается
    // у собеседника до прихода оригинала
    const thumbs = metadata?.thumbnails ?? [];
    let thumbnailBlob: Blob | null = null;
    let thumbnailWidth: number | null = null;
    for (const thumb of thumbs) {
        if (thumb._file instanceof Blob && (!thumbnailBlob || thumb._file.size < thumbnailBlob.size)) {
            thumbnailBlob = thumb._file;
            thumbnailWidth = thumb.width;
        }
    }
    const thumbnail = thumbnailBlob ? await blobToDataUri(thumbnailBlob) : null;

    // Флаги заметок (голосовое/видео-кружок)
    const flags = metadata?.flags;
    const refFlags: SecretFileRef["flags"] = flags
        ? {
            is_audio_note: flags.is_audio_note === true,
            is_video_note: flags.is_video_note === true
        }
        : null;

    return {
        ref: {
            name: name,
            mime_type: mime,
            size: size,
            duration: duration,
            width: width,
            height: height,
            thumbnail: thumbnail,
            thumbnail_width: thumbnailWidth,
            placeholder: metadata?.placeholder ?? null,
            wave_form: metadata?.wave_form ?? null,
            flags: refFlags
        },
        offer: {
            name: name,
            mime_type: mime,
            duration: duration,
            width: width,
            height: height
        }
    };

}

/**
 * ***************************************************************************
 * Тип сообщения по содержимому: заметка/картинка/видео/документ.
 * @param refs - Метаданные вложений (пустой массив — текстовое сообщение).
 * @returns Тип сообщения.
 * ***************************************************************************
 */
function resolveMessageType(refs: SecretFileRef[]): SecretMessageType {

    // Текстовое сообщение без вложений
    const first = refs[0];
    if (!first) return "text";

    // Заметки не смешиваются с обычными файлами — тип задают флаги
    if (first.flags?.is_audio_note) return "voice_note";
    if (first.flags?.is_video_note) return "video_note";

    // Однородные медиа-вложения
    if (refs.every((ref) => isKind("image", ref.mime_type))) return "image";
    if (refs.every((ref) => isKind("video", ref.mime_type))) return "video";

    // Смесь и документы
    return "document";

}
