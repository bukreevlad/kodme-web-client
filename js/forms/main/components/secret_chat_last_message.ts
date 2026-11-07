// Импортируем справочник типов файлов
import { isKind } from "../../../config/file_types.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { t } from "../../../utils/i18n/index.js";

// Импортируем components
import { Badges } from "../../../components/badges.js";

// Импортируем functions
import { getSessionUserId } from "../functions/session_identity.js";

// Импортируем типы
import { parseUnread } from "../types.js";
import type { SecretFileRef } from "../../../utils/secret_chats/secret_frames.js";
import type { SecretPreviewMessage } from "../types.js";
import type { SecretChatItem } from "./secret_chat.js";

/**
 * ***************************************************************************
 * createSecretChatLastMessage - превью последнего сообщения секретного чата.
 *
 * Своя логика для секретных чатов: данные приходят расшифрованными из
 * payload (файлы — метаданными SecretFileRef), текст — открытый plaintext,
 * сервер его не экранировал. Подписи файлов («Изображение», «Голосовое
 * сообщение», «N файлов») собираются по образцу превью обычных чатов
 * (forms/main/components/channel_last_message.ts).
 * @param item - Строка секретного чата (ей принадлежат данные и DOM).
 * @returns Элемент превью либо null (строка без данных или сбой отрисовки).
 * ***************************************************************************
 */
export function createSecretChatLastMessage(item: SecretChatItem): HTMLElement | null {

    if (!item?.data) return null;

    try {

        // Превью обязана нести запись сообщения (пустые чаты обрабатывает строка)
        const data = item.data.last_secret_message;
        if (!data) return null;

        // Создаем базовый шаблон
        const tpl = secretChatLastMessageTemplate();
        if (!tpl) return null;

        // Устанавливаем элементы
        const text = tpl.querySelector<HTMLElement>("[data-text]");
        const media = tpl.querySelector<HTMLElement>("[data-media]");

        // Текст обязателен для любой ветки рендера
        if (!text) return null;

        renderContent(data, text, media);

        // Отметка «Вы:» (секретный чат — диалог)
        const itsYou = tpl.querySelector<HTMLElement>("[data-its-you]");
        if (data.created_user_id === getSessionUserId()) {

            // Создаем элемент для безопасной вставки (textContent исключает XSS)
            const itsYouSpan = document.createElement("span");
            itsYouSpan.classList.add("text-[var(--color-brand)]");
            itsYouSpan.textContent = t("forms.main.components.channels.last_message.you");
            itsYou?.appendChild(itsYouSpan);

        }

        // Статус-иконка: своё прочитано — двойная галочка (только без ошибки отправки)
        const statusIcon = tpl.querySelector<HTMLElement>(":scope [data-status-icon]");
        if (statusIcon && !data.is_error_sending && data.created_user_id === getSessionUserId()) {

            // invariant: иконки check/checks входят в набор Icons
            const lastViewedId = item.data.display_last_viewed_message_id;
            if (lastViewedId != null && lastViewedId >= data.id) {
                statusIcon.innerHTML = Icons.icon("checks", { classes: ["stroke-brand-600", "dark:stroke-brand-500"] })?.outerHTML ?? "";
            } else {
                statusIcon.innerHTML = Icons.icon("check")?.outerHTML ?? "";
            }

        }

        // Кол. непрочитанных
        const unreadSlot = tpl.querySelector<HTMLElement>("[data-unread-count-slot]");
        const unread = parseUnread(item.data.total_unread_messages);
        const badge = Badges.primary({ value: unread === 0 ? "" : unread, max: 99 });
        unreadSlot?.replaceWith(badge.dom);

        return tpl;

    } catch (error) {
        Logger.error(error);
        return null;
    }

}

/**
 * ***************************************************************************
 * Контент превью: текст, подписи файлов и их миниатюры.
 * @param data - Превью сообщения (расшифрованные данные payload).
 * @param text - Узел текста превью.
 * @param media - Узел медиа-блока превью (может отсутствовать в шаблоне).
 * @returns void
 * ***************************************************************************
 */
function renderContent(data: SecretPreviewMessage, text: HTMLElement, media: HTMLElement | null): void {

    // Стикер-сообщение без текста: в превью показываем подпись
    if (!data.text && data.type === "sticker") {
        text.textContent = t("forms.main.components.channels.last_message.sticker");
        return;
    }

    // Текст секретного чата — открытый plaintext (сервер его не экранировал),
    // в отличие от превью обычных чатов снятие экранирования не нужно
    text.textContent = data.text ?? "";

    // Вложения: подписи и превью собираются из метаданных payload
    const files = data.files ?? [];
    if (files.length === 0 || !media) return;

    // Получаем изображения
    const images = files.filter((ref) => isKind("image", ref.mime_type));
    const audios = files.filter((ref) => isKind("audio", ref.mime_type));
    const videos = files.filter((ref) => isKind("video", ref.mime_type));

    // Если изображения найдены
    if (images.length > 0) {

        // Получаем первые три картинки
        for (let i = 0; i < images.length; i++) {
            if (i === 3) break;

            // Отображаем картинку: LQIP из метадаты, фолбэк — миниатюра payload
            const img = new Image();
            img.classList.add("aspect-1/1", "rounded-sm", "object-cover");
            img.draggable = false;
            const preview = images[i]?.placeholder ?? images[i]?.thumbnail ?? null;
            if (preview) img.src = preview;

            // Отображаем картинку
            media.prepend(img);
        }

        // Если нет текста и одна картинка — подпись
        if (!data.text && images.length === 1) {
            text.textContent = t("forms.main.components.channels.last_message.image");
            text.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]");
        }

        // Если аудио найдено
    } else if (audios.length > 0) {

        // Голосовое сообщение
        const isAudioNote = audios.some((ref) => ref.flags?.is_audio_note === true);
        if (isAudioNote) {
            text.textContent = t("forms.main.components.channels.last_message.voice_note");
            text.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]");
        } else if (audios.length === 1) {
            appendFileName(media, audios[0]);
        } else {
            appendFilesCount(media, audios.length, t("forms.messages.components.reply_footer.dec_audios", { count: audios.length }));
        }

        // Если видео найдено
    } else if (videos.length > 0) {

        // Видео-сообщение (кружок)
        const isVideoNote = videos.some((ref) => ref.flags?.is_video_note === true);
        if (isVideoNote) {
            text.textContent = t("forms.main.components.channels.last_message.video_note");
            text.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]");
        } else if (videos.length === 1) {
            appendFileName(media, videos[0]);
        } else {
            appendFilesCount(media, videos.length, t("forms.messages.components.reply_footer.dec_videos", { count: videos.length }));
        }

        // Получаем документы
    } else {

        if (files.length === 1) {
            appendFileName(media, files[0]);
        } else {
            appendFilesCount(media, files.length, t("forms.main.components.channels.last_message.dec_files", { count: files.length }));
        }

    }

}

/**
 * ***************************************************************************
 * Имя одиночного файла в медиа-блоке превью.
 * @param media - Узел медиа-блока превью.
 * @param ref - Метаданные вложения из payload.
 * @returns void
 * ***************************************************************************
 */
function appendFileName(media: HTMLElement, ref: SecretFileRef | undefined): void {

    if (!ref) return;

    // Создаем элемент для безопасной вставки (textContent исключает XSS)
    const file = document.createElement("span");
    file.textContent = ref.name;
    file.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate", "w-full", "min-w-full", "overflow-hidden");
    media.append(file);

}

/**
 * ***************************************************************************
 * Подпись числа файлов в медиа-блоке превью («3 файла» и т.п.).
 * @param media - Узел медиа-блока превью.
 * @param count - Число файлов.
 * @param word - Склонённое слово для количества.
 * @returns void
 * ***************************************************************************
 */
function appendFilesCount(media: HTMLElement, count: number, word: string): void {

    // Создаем элемент для безопасной вставки (textContent исключает XSS)
    const label = document.createElement("span");
    label.textContent = `${count} ${word}`;
    label.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate");
    media.append(label);

}

/**
 * ***************************************************************************
 * Шаблон превью последнего сообщения секретного чата.
 * @returns Элемент превью либо null (разметка не распарсилась).
 * ***************************************************************************
 */
function secretChatLastMessageTemplate(): HTMLElement | null {
    return new DOMParser().parseFromString(`
            <div class="message flex flex-row items-start gap-1">
                <div data-text-wrap class="flex flex-row items-center gap-1 w-full overflow-hidden">
                    <div data-its-you class="empty:hidden"></div>
                    <div data-media class="flex gap-1 w-full min-w-full truncate empty:hidden"></div>
                    <div class="truncate w-full flex flex-row items-center gap-0.5">
                        <div data-text class="truncate w-full"></div>
                    </div>
                </div>
                <span data-status-icon class="flex empty:hidden"></span>
                <div data-unread-count-slot></div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".message");
}
