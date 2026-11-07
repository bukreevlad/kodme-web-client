// Импортируем справочник типов файлов
import { isKind } from "../../../config/file_types.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { I18n, t } from "../../../utils/i18n/index.js";

// Импортируем components
import { Badges } from "../../../components/badges.js";

// Импортируем forms
import { Main } from "../../main/index.js";
import { getSessionUserId } from "../../main/functions/session_identity.js";

// Импортируем components
import { parseSystemMessage } from "../../messages/components/parse_system_message.js";

// Импортируем типы
import { parseUnread } from "../../main/types.js";
import type { TopicItem } from "./channel.js";
import type { ChannelRecord, MessageRecord } from "../../main/types.js";

/**
 * ***************************************************************************
 * Превью последнего сообщения для строки темы/группы.
 *
 * Для группы (type === 2) ищет самое свежее сообщение среди общего чата и
 * тем; для остальных — просто рендерит переданное.
 * @param channel - Строка элемента (тема/группа).
 * @param data - Данные канала.
 * @returns DOM-элемент превью.
 * ***************************************************************************
 */
export function createLastMessage(channel: TopicItem, data: ChannelRecord): HTMLElement {

    // Если это группа (type === 2), ищем самое последнее сообщение среди группы и тем
    if (channel.data.type === 2) {

        // Исходно считаем самым новым сообщение самой группы
        let newestMessage: MessageRecord | null | undefined = data?.last_message;
        let newestTime = newestMessage?.created_at ? new Date(newestMessage.created_at).getTime() : 0;
        let topicName = "";

        // Поиск тем этой группы в глобальном Store (главная форма может быть ещё не создана)
        let topics = Main.instance?.store.getAll().filter(item => item.topic_for_group_id === channel.data.id) ?? [];

        // Если темы найдены, сравниваем их даты
        if (topics.length > 0) {
            for (let topic of topics) {
                if (topic?.last_message?.created_at) {
                    let topicMsgTime = new Date(topic.last_message.created_at).getTime();

                    // Если сообщение в теме новее текущего лидера
                    if (topicMsgTime > newestTime) {
                        newestTime = topicMsgTime;
                        newestMessage = topic.last_message;
                        topicName = topic.display_name || "";
                    }
                }
            }
        }

        // Формируем финальный объект данных для группы
        let targetData: ChannelRecord = {
            ...data,
            last_message: newestMessage
        };

        // Отрисовываем элемент через вспомогательную функцию
        let tpl = renderMessageContent(channel, targetData);

        // Если сообщение нашлось в конкретной теме, выводим её название
        let topicNameEl = tpl.querySelector("[data-topic-name]");

        if (topicName && topicNameEl) {
            topicNameEl.textContent = `${topicName}: `;
        }

        return tpl;

    } else {

        // Для обычных диалогов и каналов просто рендерим переданную data
        return renderMessageContent(channel, data);

    }

}

/**
 * ***************************************************************************
 * Отрисовка контента сообщения в шаблон превью.
 * @param channel - Строка элемента.
 * @param data - Данные канала с финальным последним сообщением.
 * @returns DOM-элемент превью.
 * ***************************************************************************
 */
function renderMessageContent(channel: TopicItem, data: ChannelRecord): HTMLElement {

    // Создаем базовый шаблон
    let tpl = buildTemplate();

    // Устанавливаем элементы
    let userName = tpl.querySelector("[data-user-name]");
    let text = tpl.querySelector("[data-text]");

    // Текст обязателен для любой ветки рендера
    if (!text) return tpl;

    // Проверяем системное ли это сообщение
    if (data?.last_message?.action_type) {

        // Поиск системного сообщения в локализации.
        // Парсер читает из сообщения только тип события и его payload;
        // тип в записи объявлен числом, а строка локали — строковый ключ
        // (на проводе это значение вида "USER_JOINED_GROUP"), поэтому
        // собираем источник с приведением через String(): поведение
        // идентично легаси — обращение к объекту локали само приводило ключ
        let messagesLocale = I18n.tree.forms.messages.components.messages.system_messages;
        let systemSource = { ...data.last_message, action_type: String(data.last_message.action_type) };
        text.textContent = parseSystemMessage(systemSource, messagesLocale);

    } else {
        text.textContent = data?.last_message?.text ?? null;
    }

    // Если сообщение от текущего пользователя
    let itsYou = tpl.querySelector("[data-its-you]");
    let itsMe = data?.last_message?.created_user_id === getSessionUserId() ? t("forms.main.components.channels.last_message.you") : "";
    const type = data.type;
    if (itsMe && type != null && [1, 2, 4].includes(type)) itsYou && (itsYou.innerHTML = `<span class="text-[var(--color-green)]">${itsMe}</span>`);
    if (!itsMe && type != null && [2, 4].includes(type) && userName) {

        // Имя пользователя — внешние данные: вставка только через
        // textContent (innerHTML открыл бы XSS)
        const nameSpan = document.createElement("span");
        nameSpan.classList.add("text-secondary", "truncate");
        nameSpan.textContent = data?.last_message?.display_name ?? "";
        userName.append(nameSpan);

    }

    // Статус иконка
    let statusIcon = tpl.querySelector(":scope [data-status-icon]");

    // Кол. непрочитанных
    let unreadCount = tpl.querySelector("[data-unread-count-slot]");
    let badge = Badges.primary({ value: data.total_unread_messages ? parseUnread(data.total_unread_messages) : "", max: 99 });
    unreadCount?.replaceWith(badge.dom);

    // Проверка статуса сообщения (диалог)
    if (!data?.last_message?.is_error_sending && !data?.last_message?.is_temporary) {
        if (type === 1 && (getSessionUserId() === data?.last_message?.created_user_id)) {

            // NOTE(MIGRATION): в легаси отсутствие id давало сравнение
            // null/undefined с id (NaN → false) — сохраняем поведение явной
            // проверкой; invariant: иконки check/checks входят в набор Icons
            const lastViewedId = data.display_last_viewed_message_id;
            if (statusIcon) {
                if (lastViewedId != null && lastViewedId >= data.last_message.id) {
                    // NOTE(MIGRATION): аргумент классов раньше передавался третьим
                    // параметром — иконки он игнорировал, и статус рисовался
                    // без брендинговой обводки. Классы перенесены в options (как в
                    // одноимённом компоненте главного экрана)
                    statusIcon.innerHTML = Icons.icon("checks", { classes: ["stroke-brand-600", "dark:stroke-brand-500"] })?.outerHTML ?? "";
                } else {
                    statusIcon.innerHTML = Icons.icon("check")?.outerHTML ?? "";
                }
            }
        }
    }

    // Медиа
    let media = tpl.querySelector("[data-media]");

    // Если есть вложения
    if (data?.last_message?.attachments) {

        // Узел медиа обязан быть в шаблоне — без него вложения не показываем
        if (!media) return tpl;

        // Получаем изображения
        let images = data?.last_message?.attachments?.filter(at => isKind("image", at.mime_type));
        let audios = data?.last_message?.attachments?.filter(at => isKind("audio", at.mime_type));
        let videos = data?.last_message?.attachments?.filter(at => isKind("video", at.mime_type));

        // Если изображения найдены
        if (images && images.length > 0) {

            // Получаем первые три картинки
            for (let i = 0; i < images.length; i++) {
                if (i === 3) break;

                // Отображаем картинку
                let img = new Image();
                img.classList.add("aspect-1/1", "rounded-sm", "object-cover");

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
                text.innerHTML = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)]">${t("forms.main.components.channels.last_message.image")}</span>`;
            }

            // Если аудио найдено
        } else if (audios && audios.length > 0) {

            // Получаем metadata
            let isVoice = audios.find(au => au?.metadata?.flags?.is_audio_note === true);

            // Если это голосовое сообщение
            if (isVoice) {
                let audio = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)]">${t("forms.main.components.channels.last_message.voice_note")}</span>`;
                text.innerHTML = audio;
            } else {
                if (audios.length === 1) {
                    // Отображаем название
                    let file = document.createElement("span");
                    file.textContent = audios[0]?.name || audios[0]?.file_name || null;
                    file.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate", "overflow-hidden");
                    media.append(file);
                } else if (audios.length > 1) {
                    // Отображаем количество
                    let counts = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)] truncate">
                    ${audios.length} ${t("forms.messages.components.reply_footer.dec_audios", { count: audios.length })}</span>`;
                    media.innerHTML = counts;
                }
            }

            // Если видео найдено
        } else if (videos && videos.length > 0) {

            // Получаем metadata
            let isVideoNote = videos.find(au => au?.metadata?.flags?.is_video_note === true);

            // Если это видео сообщение
            if (isVideoNote) {
                let video = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)]">${t("forms.main.components.channels.last_message.video_note")}</span>`;
                text.innerHTML = video;
            } else {
                if (videos.length === 1) {
                    // Отображаем название
                    let file = document.createElement("span");
                    file.textContent = videos[0]?.name || videos[0]?.file_name || null;
                    file.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate", "overflow-hidden");
                    media.append(file);
                } else if (videos.length > 1) {
                    // Отображаем количество
                    let counts = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)] truncate">
                                ${videos.length} ${t("forms.messages.components.reply_footer.dec_videos", { count: videos.length })}</span>`;
                    media.innerHTML = counts;
                }
            }

        } else {

            // Получаем документы
            let documents = data?.last_message?.attachments;
            if (documents) {
                if (documents.length === 1) {
                    // Отображаем название
                    let file = document.createElement("span");
                    file.textContent = documents[0]?.name || documents[0]?.file_name || null;
                    file.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate", "overflow-hidden");
                    media.append(file);
                } else if (documents.length > 1) {
                    // Отображаем количество
                    let files = `<span class="text-[var(--color-brand)] dark:text-[var(--color-brand)] truncate">
                    ${documents.length} ${t("forms.main.components.channels.last_message.dec_files", { count: documents.length })}
                </span>`;
                    media.innerHTML = files;
                }
            }
        }
    }

    return tpl;

}

/**
 * ***************************************************************************
 * Шаблон превью последнего сообщения.
 * @returns DOM-элемент превью.
 * ***************************************************************************
 */
function buildTemplate(): HTMLElement {

    // invariant: корневой .message входит в сам шаблон — querySelector
    // с текстовым HTML всегда находит его
    return new DOMParser().parseFromString(`
            <div class="message flex flex-row items-start gap-1">
                <div data-text-wrap class="flex flex-row items-center gap-1 w-full overflow-hidden">
                    <div data-its-you class="empty:hidden"></div>
                    <div data-media class="flex gap-1 empty:hidden"></div>
                    <div class="truncate w-full flex flex-row items-center gap-0.5">
                        <span data-topic-name class="font-semibold bg-[var(--color-black)]/5 dark:bg-[var(--color-white)]/10 px-1 rounded-lg empty:hidden shrink-0"></span>
                        <div data-user-name class="bg-[var(--color-black)]/5 dark:bg-[var(--color-white)]/10 px-1 rounded-lg empty:hidden shrink-0"></div>
                        <div data-text class="truncate w-full"></div>
                    </div>
                </div>
                <span data-status-icon class="flex empty:hidden"></span>
                <div data-unread-count-slot></div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".message")!;
}
