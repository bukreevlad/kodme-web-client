// Импортируем справочник типов файлов
import { isKind } from "../../../config/file_types.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { getDeclension } from "../../../utils/string/declensions.js";
import { unescapeHtml } from "../../../utils/string/unescape_html.js";

// Импортируем components
import { Badges } from "../../../components/badges.js";

// Импортируем forms
import { Main } from "../index.js";

// Импортируем functions
import { getSessionUserId } from "../functions/session_identity.js";

// Импортируем components
import { parseSystemMessage } from "../../messages/components/parse_system_message.js";

// Импортируем типы
import { parseUnread } from "../types.js";
import type { ChannelItem } from "./channel.js";
import type { ChannelAttachment, ChannelRecord } from "../types.js";

/**
 * ***************************************************************************
 * Превью последнего сообщения в строке канала.
 *
 * Для группы топиком ищется самое свежее сообщение среди её тем, а
 * непрочитанные суммируются по темам (как в бейджах папок).
 * @param channel - Строка канала (ей принадлежат данные и DOM).
 * @returns Элемент превью либо null (строка без данных или сбой отрисовки).
 * ***************************************************************************
 */
export function createLastMessage(channel: ChannelItem): HTMLElement | null {

    if (!channel?.data) return null;

    try {

        // Если это группа (type === 2), ищем самое последнее сообщение и суммируем непрочитанные
        if (channel?.data?.type === 2) {

            // Исходно считаем самым новым сообщение самой группы
            let newestMessage = channel?.data?.last_message;
            let newestTime = newestMessage?.created_at ? new Date(newestMessage.created_at).getTime() : 0;
            let topicName = "";

            // Начальное количество непрочитанных — из самой группы
            let totalUnread = parseUnread(channel?.data?.total_unread_messages) || 0;

            // Поиск топиков этой группы в Store (главная форма может быть ещё не создана)
            const storeItems: ChannelRecord[] = Main.instance?.store.getAll() ?? [];
            const topics = storeItems.filter(item => item.topic_for_group_id === channel?.data?.id);

            // Если топики найдены, суммируем непрочитанные и сравниваем даты сообщений
            if (topics.length > 0) {
                for (let topic of topics) {

                    // Прибавляем счетчик непрочитанных текущего топика
                    totalUnread += parseUnread(topic?.total_unread_messages) || 0;

                    if (topic?.last_message?.created_at) {
                        let topicMsgTime = new Date(topic.last_message.created_at).getTime();

                        // Если сообщение в топике новее текущего лидера
                        if (topicMsgTime > newestTime) {
                            newestTime = topicMsgTime;
                            newestMessage = topic.last_message;
                            topicName = topic.display_name || "";
                        }
                    }
                }
            }

            // Формируем финальный объект данных для группы
            const targetData: ChannelRecord = {
                ...channel?.data,
                last_message: newestMessage,
                total_unread_messages: totalUnread
            };

            // Отрисовываем элемент через вспомогательную функцию
            const tpl = renderMessage(channel, targetData);

            // Если сообщение нашлось в конкретном топике, выводим его название
            const topicNameEl = tpl?.querySelector<HTMLElement>("[data-topic-name]");
            if (topicName && topicNameEl) {
                topicNameEl.textContent = `${topicName}: `;
            }

            return tpl;

        } else {

            // Для обычных диалогов и каналов просто рендерим переданную data
            return renderMessage(channel, channel?.data);

        }

    } catch (error) {
        Logger.error(error);
        return null;
    }

}

/**
 * ***************************************************************************
 * Отрисовка контента сообщения в шаблон превью.
 * @param channel - Строка канала (владелец бейджа непрочитанных).
 * @param data - Данные канала с превью (у группы — уже со свежайшим сообщением).
 * @returns Элемент превью либо null (разметка не распарсилась).
 * ***************************************************************************
 */
function renderMessage(channel: ChannelItem, data: ChannelRecord): HTMLElement | null {

    // Создаем базовый шаблон
    const tpl = lastMessageTemplate();

    // Без узлов шаблона превью не собирается
    if (!tpl) return null;

    // Устанавливаем элементы
    const userName = tpl.querySelector<HTMLElement>("[data-user-name]");
    const text = tpl.querySelector<HTMLElement>("[data-text]");

    // Текст обязателен для любой ветки рендера
    if (!text) return null;

    // Проверяем системное ли это сообщение
    if (data?.last_message?.action_type) {

        // Поиск системного сообщения в локализации.
        // Парсер читает из сообщения только тип события и его payload;
        // тип в записи объявлен числом, а строка локали — строковый ключ
        // (на проводе это значение вида "USER_JOINED_GROUP"), поэтому
        // собираем источник с приведением через String(): поведение
        // идентично легаси — обращение к объекту локали само приводило ключ
        const messagesLocale = window._lc.forms.messages.components.messages.system_messages;
        const systemSource = { ...data.last_message, action_type: String(data.last_message.action_type) };
        text.textContent = parseSystemMessage(systemSource, messagesLocale);

    } else {

        // Стикер-сообщение без текста: в превью показываем подпись
        if (!data?.last_message?.text && data?.last_message?.sticker_document_id) {
            text.textContent = window._lc.forms.main.components.channels.last_message.sticker;

            // Сервер присылает текст экранированным, поэтому снимаем одно экранирование.
            // NOTE(MIGRATION): пустой текст нормализуется — null/undefined в
            // unescapeHtml упал бы в catch и превью не отрисовалось вовсе
        } else {
            text.textContent = unescapeHtml(data?.last_message?.text ?? "");
        }

    }

    // Если сообщение от текущего пользователя
    const itsYou = tpl.querySelector<HTMLElement>("[data-its-you]");
    const itsMe = data?.last_message?.created_user_id === getSessionUserId() ? window._lc.forms.main.components.channels.last_message.you : "";
    const type = data.type;
    if (itsMe && type != null && [1, 2, 4].includes(type)) {

        // Создаем элемент для безопасной вставки (textContent исключает XSS)
        const itsYouSpan = document.createElement("span");
        itsYouSpan.classList.add("text-[var(--color-brand)]");
        itsYouSpan.textContent = itsMe;
        itsYou?.appendChild(itsYouSpan);

    }
    if (!itsMe && type != null && [2, 4].includes(type)) {

        // Создаем элемент для безопасной вставки имени (textContent исключает XSS)
        const userNameSpan = document.createElement("span");
        userNameSpan.classList.add("text-secondary", "truncate");
        userNameSpan.textContent = data?.last_message?.display_name ?? null;
        userName?.appendChild(userNameSpan);

    }

    // Статус иконка
    const statusIcon = tpl.querySelector<HTMLElement>(":scope [data-status-icon]");

    // Проверка статуса сообщения (диалог)
    if (!data?.last_message?.is_error_sending && !data?.last_message?.is_temporary) {
        if (type === 1 && (getSessionUserId() === data?.last_message?.created_user_id)) {

            // NOTE(MIGRATION): в легаси отсутствие id давало сравнение
            // null/undefined с id (NaN → false) — сохраняем поведение явной
            // проверкой; invariant: иконки check/checks входят в набор Icons
            const lastViewedId = data.display_last_viewed_message_id;
            if (statusIcon) {
                if (lastViewedId != null && lastViewedId >= data.last_message.id) {
                    statusIcon.innerHTML = Icons.icon("checks", { classes: ["stroke-brand-600", "dark:stroke-brand-500"] })?.outerHTML ?? "";
                } else {
                    statusIcon.innerHTML = Icons.icon("check")?.outerHTML ?? "";
                }
            }
        }
    }

    // Кол. непрочитанных
    const unreadSlot = tpl.querySelector<HTMLElement>("[data-unread-count-slot]");
    const unread = parseUnread(data.total_unread_messages);
    const badge = Badges.primary({ value: unread === 0 ? "" : unread, max: 99 });
    unreadSlot?.replaceWith(badge.dom);

    // Медиа
    const media = tpl.querySelector<HTMLElement>("[data-media]");

    // Если есть вложения
    if (data?.last_message?.attachments) {

        // Узел медиа обязан быть в шаблоне — без него вложения не показываем
        if (!media) return tpl;

        // Получаем изображения
        const attachments: ChannelAttachment[] = data?.last_message?.attachments;
        const images = attachments.filter(at => isKind("image", at.mime_type));
        const audios = attachments.filter(at => isKind("audio", at.mime_type));
        const videos = attachments.filter(at => isKind("video", at.mime_type));

        // Если изображения найдены
        if (images.length > 0) {

            // Получаем первые три картинки
            for (let i = 0; i < images.length; i++) {
                if (i === 3) break;

                // Отображаем картинку
                const img = new Image();
                img.classList.add("aspect-1/1", "rounded-sm", "object-cover");
                img.draggable = false;

                // Если есть placeholder у картинки
                const placeholder = images[i]?.metadata?.placeholder;
                if (placeholder) {
                    img.src = placeholder;
                }

                // Отображаем картинку
                media.prepend(img);
            }

            // Если нет текста и одна картинка
            if (!data?.last_message.text && images.length === 1) {
                text.innerHTML = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)]">${window._lc.forms.main.components.channels.last_message.image}</span>`;
            }

            // Если аудио найдено
        } else if (audios.length > 0) {

            // Получаем metadata
            const isAudioNote = audios.find(au => au?.metadata?.flags?.is_audio_note === true);

            // Если это голосовое сообщение
            if (isAudioNote) {
                const audio = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)]">${window._lc.forms.main.components.channels.last_message.voice_note}</span>`;
                text.innerHTML = audio;
            } else {
                if (audios.length === 1) {
                    // Отображаем название
                    const file = document.createElement("span");
                    file.textContent = audios[0]?.name || audios[0]?.file_name || null;
                    file.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate", "w-full", "min-w-full", "overflow-hidden");
                    media.append(file);
                } else if (audios.length > 1) {
                    // Отображаем количество
                    const counts = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)] truncate">
                    ${audios.length} ${getDeclension(audios.length, window._lc.forms.messages.components.reply_footer.dec_audios)}</span>`;
                    media.innerHTML = counts;
                }
            }

            // Если видео найдено
        } else if (videos.length > 0) {

            // Получаем metadata
            const isVideoNote = videos.find(au => au?.metadata?.flags?.is_video_note === true);

            // Если это видео сообщение
            if (isVideoNote) {
                const video = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)]">${window._lc.forms.main.components.channels.last_message.video_note}</span>`;
                text.innerHTML = video;
            } else {
                if (videos.length === 1) {
                    // Отображаем название
                    const file = document.createElement("span");
                    file.textContent = videos[0]?.name || videos[0]?.file_name || null;
                    file.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate", "w-full", "min-w-full", "overflow-hidden");
                    media.append(file);
                } else if (videos.length > 1) {
                    // Отображаем количество
                    const counts = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)] truncate">
                    ${videos.length} ${getDeclension(videos.length, window._lc.forms.messages.components.reply_footer.dec_videos)}</span>`;
                    media.innerHTML = counts;
                }
            }

        } else {

            // Получаем документы
            const documents: ChannelAttachment[] = attachments;
            if (documents.length === 1) {
                // Отображаем название
                const file = document.createElement("span");
                file.textContent = documents[0]?.name || documents[0]?.file_name || null;
                file.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate", "w-full", "min-w-full", "overflow-hidden");
                media.append(file);
            } else if (documents.length > 1) {
                // Отображаем количество
                const files = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)] truncate">
                    ${documents.length} ${getDeclension(documents.length, window._lc.forms.main.components.channels.last_message.dec_files)}
                </span>`;
                media.innerHTML = files;
            }
        }
    }

    return tpl;

}

/**
 * ***************************************************************************
 * Шаблон превью последнего сообщения.
 * Добавлен тег <span data-topic-name> для вывода имени темы перед текстом.
 * @returns Элемент превью либо null (разметка не распарсилась).
 * ***************************************************************************
 */
function lastMessageTemplate(): HTMLElement | null {
    return new DOMParser().parseFromString(`
            <div class="message flex flex-row items-start gap-1">
                <div data-text-wrap class="flex flex-row items-center gap-1 w-full overflow-hidden">
                    <div data-its-you class="empty:hidden"></div>
                    <div data-media class="flex gap-1 w-full min-w-full truncate empty:hidden"></div>
                    <div class="truncate w-full flex flex-row items-center gap-0.5">
                        <span data-topic-name class="font-semibold bg-[var(--color-black)]/5 dark:bg-[var(--color-white)]/10 px-1 rounded-lg empty:hidden shrink-0"></span>
                        <div data-user-name class="bg-[var(--color-black)]/5 dark:bg-[var(--color-white)]/10 px-1 rounded-lg empty:hidden shrink-0"></div>
                        <div data-text class="truncate w-full"></div>
                    </div>
                </div>
                <span data-status-icon class="flex empty:hidden"></span>
                <div data-unread-count-slot></div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".message");
}
