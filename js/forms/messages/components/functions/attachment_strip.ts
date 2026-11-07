// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { getDeclension } from "../../../../utils/string/declensions.js";
import { unescapeHtml } from "../../../../utils/string/unescape_html.js";
import { CacheManager } from "../../../../utils/cache_manager.js";
import { forStorage } from "../../../../utils/network/storage_url.js";
import * as Attachments from "../../../../utils/messages/attachments.js";
import * as AttachClassifier from "../../../../utils/messages/attach_classifier.js";

// Импортируем типы
import { normalizeAttachments } from "../types.js";
import type { AttachmentData, MessageData } from "../types.js";
import type { AttachmentsRaw } from "../../../../utils/messages/attachments.js";

/**
 * Структурный минимум данных для сборки превью: текст, имя автора и
 * вложения (массив сервера или мапа temp-записи).
 */
export interface AttachmentStripData {

    /** Отображаемое имя автора. */
    display_name?: string | null;

    /** Текст (HTML-экранирован). */
    text?: string | null;

    /** Вложения (серверный массив или мапа). */
    attachments?: AttachmentsRaw;

    /** Id документа стикера (sticker-сообщение хранит его вне attachments). */
    sticker_document_id?: string | null;

    /** Токен на чтение файла стикера. */
    sticker?: string | null;

}

/**
 * DOM-элементы, которые заполняет сборщик превью.
 */
export interface AttachmentStripElements {

    /** Элемент имени автора. */
    displayName?: Element | null;

    /** Элемент подписи (truncate). */
    text?: Element | null;

    /** Контейнер превью вложений. */
    media?: Element | null;

}

/**
 * Опции сборщика превью.
 */
export interface AttachmentStripOptions {

    /**
     * Корневой ключ локали в `window._lc`:
     * "reply_footer" — `forms.messages.components.reply_footer`.
     */
    localeScope?: "reply" | "reply_footer";

}

/**
 * ***************************************************************************
 * attachmentStrip - сборка превью вложений для «компактных» мест формы
 * сообщений: ответ на сообщение (message_reply), футер ответа
 * (footer_reply_message) и футер редактирования (footer_edit_message).
 *
 * Раньше эти три файла содержали ~180 одинаковых строк, расходившихся между
 * собой только набором локализационных ключей. Здесь вся логика одна, а
 * отличия передаются через options.localeScope.
 *
 * Бонус: вложения нормализуются через Attachments, поэтому блок корректно
 * работает и для серверного массива, и для object-map у temp-сообщений
 * (раньше `.filter` на объекте падал с TypeError).
 * @param data - Данные сообщения/комментария (text, attachments, display_name).
 * @param elements - Найденные DOM-элементы.
 * @param options - Опции.
 * @returns void
 * ***************************************************************************
 */
export function attachmentStrip(data: AttachmentStripData | MessageData | null | undefined, elements: AttachmentStripElements, options: AttachmentStripOptions = {}): void {

    try {

        // Защита: нет данных — очищаем контейнеры и выходим
        if (!data) {
            elements.media && (elements.media.innerHTML = "");
            elements.text && (elements.text.textContent = "");
            elements.displayName && (elements.displayName.textContent = "");
            return;
        }

        // Локализация: ветка "reply" в components отсутствует (живёт в
        // messages.reply) — честное чтение без индексации несуществующего
        // ключа; поведение «reply → undefined» идентично легаси.
        const localeScope = options.localeScope || "reply";
        const locale = localeScope === "reply_footer"
            ? window._lc?.forms?.messages?.components?.reply_footer
            : undefined;

        // Заполняем текст и имя
        if (elements.displayName) elements.displayName.textContent = data.display_name || "";
        if (elements.text) elements.text.textContent = unescapeHtml(data.text || "");

        // Стикер-сообщение: документ лежит в sticker_document_id (в attachments
        // его нет) — показываем маленькое превью и акцентную подпись «Стикер»,
        // как у фото/голосовых/кружков. Такое сообщение не бывает с attachments
        // — ветка завершает сборку.
        if (data.sticker_document_id) {

            // Маленькое превью стикера (та же ссылка, что у тела сообщения)
            const img = new Image();
            img.classList.add("w-8", "h-8", "rounded-sm", "object-contain");
            img.src = data.sticker
                ? CacheManager.getMediaSrc({
                    url: forStorage(data.sticker_document_id),
                    file_token: data.sticker,
                    type: "media"
                })
                : forStorage(data.sticker_document_id);
            img.alt = "";
            elements.media?.prepend(img);

            // Без текста подписываем акцентным «Стикер»
            if (!data.text) _setAccentText(elements.text, locale?.sticker);

            return;

        }

        // Нет вложений — очищаем превью и выходим
        if (!Attachments.isNotEmpty(data.attachments)) return;

        // Приводим вложения к массиву (Array с сервера / object-map у temp)
        const all = normalizeAttachments(data.attachments);

        // Раскладываем по типам через общий классификатор: он учитывает и
        // mime_type/type (сервер/локальный файл), и метадату голосовых и
        // видео-кружков. Раньше здесь были свои копии проверок mime.
        const images = AttachClassifier.filterByType(all, AttachClassifier.ATTACH_TYPES.IMAGE);
        const audios = all.filter(attach => {

            const type = AttachClassifier.classify(attach);

            return type === AttachClassifier.ATTACH_TYPES.AUDIO
                || AttachClassifier.isAudioNote(attach);

        });
        const videos = all.filter(attach => {

            const type = AttachClassifier.classify(attach);

            return type === AttachClassifier.ATTACH_TYPES.VIDEO
                || AttachClassifier.isVideoNote(attach);

        });

        // Приоритет: изображения → аудио → видео → документы
        if (images.length > 0) {

            // Показываем до MAX_IMAGE_PREVIEWS превью
            for (let i = 0; i < images.length && i < MAX_IMAGE_PREVIEWS; i++) {

                // Placeholder приходит из метадаты классификатора как unknown —
                // честная проверка типа вместо приведения; нестроковые значения
                // пропускаются, как и раньше (falsy)
                const placeholder = images[i]?.metadata?.placeholder;
                if (typeof placeholder !== "string") continue;

                // Отображаем картинку
                const img = new Image();
                img.classList.add("aspect-1/1", "rounded-sm", "object-cover");
                img.src = placeholder;
                img.alt = "";
                elements.media?.prepend(img);

            }

            // Если нет текста и одна картинка — показываем подпись
            if (!data.text && images.length === 1 && elements.text) {
                _setAccentText(elements.text, locale?.image);

            }

        } else if (audios.length > 0) {

            // Голосовое сообщение
            if (audios.some(au => au?.metadata?.flags?.is_audio_note === true)) {
                _setAccentText(elements.text, locale?.voice_note);
            } else {
                _setFileOrCount(elements.media, elements.text, audios, locale?.dec_audios);
            }

        } else if (videos.length > 0) {

            // Видеосообщение (кружок)
            if (videos.some(vid => vid?.metadata?.flags?.is_video_note === true)) {
                _setAccentText(elements.text, locale?.video_note);
            } else {
                _setFileOrCount(elements.media, elements.text, videos, locale?.dec_videos);
            }

        } else {

            // Документы и прочее
            _setFileOrCount(elements.media, elements.text, all, locale?.dec_files);

        }

    } catch (error) {
        Logger.error("[app][messages][attachment-strip]:", error);
    }

}

// Сколько превью изображений показываем подряд
const MAX_IMAGE_PREVIEWS = 3;

/**
 * ***************************************************************************
 * Приватный: вывести акцентный текст (подпись вида «Голосовое сообщение»).
 * @param element - Элемент подписи.
 * @param text - Текст подписи (из локали).
 * ***************************************************************************
 */
function _setAccentText(element: Element | null | undefined, text?: string): void {

    if (!element || !text) return;

    // Мы используем DOM, чтобы не собирать HTML-строку из локали
    element.textContent = "";
    const span = document.createElement("span");
    span.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]");
    span.textContent = text;
    element.appendChild(span);

}

/**
 * ***************************************************************************
 * Приватный: один файл — показываем имя, несколько — склонённое количество.
 * @param media - Контейнер превью вложений.
 * @param text - Элемент подписи (не используется, оставлен для единообразия вызова).
 * @param items - Массив вложений одного типа.
 * @param declensions - Формы слова: ["файл", "файла", "файлов"].
 * ***************************************************************************
 */
function _setFileOrCount(media: Element | null | undefined, text: Element | null | undefined, items: AttachmentData[], declensions?: string[]): void {

    // Один файл — имя файла
    if (items.length === 1) {

        const file = document.createElement("span");
        file.textContent = items[0]?.name || items[0]?.file_name || "";
        file.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate", "overflow-hidden");
        media?.appendChild(file);
        return;

    }

    // Несколько — «N файлов»
    if (!media) return;

    const forms = Array.isArray(declensions) && declensions.length === 3
        ? declensions
        : ["файл", "файла", "файлов"];

    const count = document.createElement("span");
    count.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]", "truncate");
    count.textContent = `${items.length} ${getDeclension(items.length, forms)}`;
    media.innerHTML = "";
    media.appendChild(count);

}
