// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { parseError } from "../../../utils/network/parse_error.js";
import { resolveMimeType } from "../../../utils/validation/file_validator.js";
import { uploadDerivedAssets, matchBlobsToTargets } from "../../../utils/media/upload_derived_assets.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";

// Импортируем components
import { ProgressIndicator } from "../../../components/progress.js";
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { getUploadThumbUrlRequest } from "../requests/get_upload_url_thumb.js";
import { saveThumbRequest } from "../requests/save_thumb.js";

// Импортируем типы
import type { BroadcastSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Выбор и загрузка обложки трансляции: открывает системный выбор файла,
 * заливает оригинал в S3 и записывает обложку трансляции. Превью, цвета
 * и LQIP создаёт сервер после save.
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function choosePhoto(form: BroadcastSettings): Promise<void> {

    try {

        // Создаем инпут выбора файлов
        const input = document.createElement("input");
        input.multiple = false;
        input.type = "file";

        // Действие выбора файлов
        input.onchange = async () => {

            // Получаем выбранный файл (чтение из инпута напрямую: event.target
            // типизирован как EventTarget и потребовал бы приведения типов)
            const file = input.files?.[0];
            if (!file) return;

            try {

                // Получаем пре-подписанную ссылку для загрузки в S3
                const getUploadUrl = await getUploadThumbUrlRequest({
                    cast_id: form.castId,
                    file_name: file.name,
                    // MIME и размер обязательны: сервер сверяет MIME с расширением,
                    // а размер подписывается в POST policy (без него — FILE_SIZE_REQUIRED)
                    mime_type: resolveMimeType(file),
                    size: file.size
                });

                // Создаем и настраиваем компонент прогресса
                const progress = new ProgressIndicator({ width: "50%" });
                const progressElement = progress.getElement();
                form.thumb?.appendChild(progressElement);

                // Переводим в состояние ожидания/обработки
                progress.setProcessing();

                // Грузим только оригинал: превью, цвета и LQIP создаёт
                // сервер после save thumb, presigned-цели на производные
                // больше не подписываются
                await uploadDerivedAssets({
                    request: getUploadUrl.data,
                    blobs: matchBlobsToTargets(getUploadUrl.data.targets, [
                        { kind: "original", blob: file, mime_type: resolveMimeType(file) }
                    ]),
                    onProgress: ({ percent }) => {
                        progress.update(percent);
                    }
                });

                // Переводим прогрессбар в состояние обработки:
                // загрузка в S3 завершена, идёт запись превью трансляции
                progress.setProcessing();

                // Записываем обложку трансляции
                const response = await saveThumbRequest({
                    cast_id: form.castId,
                    document_id: getUploadUrl.data.document_id
                });

                // Удаляем прогресс-бар с задержкой для плавности
                setTimeout(() => {
                    if (progress) progress.destroy();
                }, 1000);

                // Если есть обложка
                if (response.data) {

                    // Получения размера миниатюры
                    const thumbnails = response.data?.metadata?.thumbnails;
                    const thumbSize = getThumbnailSizeQuery(thumbnails, 1200);

                    // Формируем ссылку через CacheManager
                    const mediaUrl = CacheManager.getMediaSrc({
                        url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${response.data.id}${thumbSize?.string}`,
                        file_token: response.data.token,
                        type: "image"
                    });

                    // Устанавливаем ссылку
                    if (form.thumbImage) form.thumbImage.src = mediaUrl;

                }

                // Toast
                Toast.success(t("forms.broadcast_settings.toasts.success_thumb"));

            } catch (error) {
                Logger.error(error);

                // Имя ошибки берём из разбора: у ApiError поле name —
                // "ApiError", а имя вида MEDIA_PROCESSING_DISABLED
                // лежит в message формата «ИМЯ :: код»
                const info = parseError(error);

                // Хранилище отклонило запрос (400 от S3, например
                // пустое тело от Safari) — свой текст
                if (info.code === "UPLOAD_REJECTED") {
                    Toast.error(t("api.errors.upload_rejected"));
                } else if (info.name === "MEDIA_PROCESSING_DISABLED") {
                    // Обработка выключена конфигом
                    Toast.error(t("api.errors.media_processing_disabled"));
                } else if (info.isAccessDenied) {
                    // Не владелец трансляции — доступ запрещён
                    Toast.error(t("forms.broadcast_settings.toasts.access_denied"));
                } else {
                    // Toast
                    Toast.error(t("forms.broadcast_settings.toasts.thumb_error"));
                }
            }

        };

        // Открываем диалог выбора файлов
        input.click();

    } catch (error) {
        Logger.error(error);

        // Прочая ошибка сервера
        Toast.error(t("api.errors.server_error"));
    }

}
