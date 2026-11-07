// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import * as AttachClassifier from "../../../utils/messages/attach_classifier.js";

// Импортируем components (вложенные) — локальные фабрики вложений
import { createAudioNoteItem } from "./attaches_audio_note.js";
import { createAudioItem } from "./attaches_audio.js";
import { createVideoItem } from "./attaches_video.js";
import { createVideoNoteItem } from "./attaches_video_note.js";
import { createDocumentItem } from "./attaches_document.js";
import { createImageItem } from "./attaches_image.js";

// Импортируем типы
import { normalizeAttachments } from "./types.js";
import type { AttachParent } from "./types.js";
import type { CommentRecord } from "../types.js";

/**
 * ***************************************************************************
 * commentAttaches - сборка блока вложений комментария.
 *
 * Классификация файлов единым классификатором и раскладка по контейнерам
 * (медиа/аудио/документы) — как в строке сообщения: фабрики вложений
 * переиспользуются напрямую, им нужен только структурный родитель
 * `AttachParent` (доступ к записи для MediaViewer/автора аудио).
 *
 * Вызывается при рендере строки (createCommentItem) и при её обновлении
 * (смена записей Store) — контейнеры очищаются и пересобираются целиком.
 * @param comment - Данные комментария.
 * @param item - Корневой DOM-узел строки комментария.
 * @returns void
 * ***************************************************************************
 */
export function commentAttaches(comment: CommentRecord, item: HTMLElement): void {

    try {

        // Подконтейнеры обязаны входить в шаблон — иначе раскладывать нечего
        const documentsContainer = item.querySelector(":scope attaches >[data-documents]");
        const audiosContainer = item.querySelector(":scope attaches >[data-audios]");
        const mediaContainer = item.querySelector<HTMLElement>(":scope attaches >[data-media]");
        if (!documentsContainer || !audiosContainer || !mediaContainer) return;

        // Очищаем список
        documentsContainer.innerHTML = "";
        audiosContainer.innerHTML = "";
        mediaContainer.innerHTML = "";

        // Нормализуем вложения в массив: сервер отдаёт массив, локальные
        // (temp/pending) комментарии — объект-мап по temp_id/document_id
        const attachments = normalizeAttachments(comment.attachments);

        // Родитель для фабрик: запись комментария (attachments/display_name)
        const parent: AttachParent = { data: comment };

        // Признак видео-кружка в строке: выставляется toggle ПОСЛЕ цикла —
        // commentAttaches вызывается при каждой перерисовке, и кружок,
        // удалённый правкой, не должен оставить за собой прозрачный пузырь
        let hasVideoNote = false;

        // Проходим по файлам
        for (const attachment of attachments) {

            // Пропускаем мусор (редкое, но не повод ронять весь блок)
            if (!attachment) continue;

            // Тип вложения определяет единый классификатор
            const type = AttachClassifier.classify(attachment);

            // Изображение
            if (type === AttachClassifier.ATTACH_TYPES.IMAGE) {
                mediaContainer.append(createImageItem(parent, attachment));

                // Голосовое сообщание (проверка на волну — внутри isAudioNote)
            } else if (AttachClassifier.isAudioNote(attachment)) {
                audiosContainer.append(createAudioNoteItem(parent, attachment));

                // Обычное аудио
            } else if (type === AttachClassifier.ATTACH_TYPES.AUDIO) {
                audiosContainer.append(createAudioItem(parent, attachment));

                // Видео-кружок
            } else if (AttachClassifier.isVideoNote(attachment)) {

                // Помечаем строку как video-note (прозрачный пузырь в CSS)
                hasVideoNote = true;
                mediaContainer.append(createVideoNoteItem(attachment));

                // Обычное видео
            } else if (type === AttachClassifier.ATTACH_TYPES.VIDEO) {
                mediaContainer.append(createVideoItem(parent, attachment));

            } else {

                // Простой документ
                documentsContainer.append(createDocumentItem(attachment));

            }

        }

        // Итоговая отметка строки (парный маркер из message_attaches)
        item.classList.toggle("video-note", hasVideoNote);

    } catch (error) {
        Logger.error("[app][comments][attaches]", error);
    }

}
