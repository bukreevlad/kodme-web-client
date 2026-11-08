// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { parseError } from "../../../utils/network/parse_error.js";
import { cropImage } from "../../../utils/image/image_cropper.js";
import { uploadDerivedAssets, matchBlobsToTargets } from "../../../utils/media/upload_derived_assets.js";

// Импортируем config
// MIME берём из справочника напрямую: обёртка utils/validation
// принимает только File, а здесь на вход webp-Blob из cropImage
import { resolveMimeType } from "../../../config/file_types.js";

// Импортируем components
import { ImageCropper } from "../../../forms/image-cropper/index.js";
import { ProgressIndicator } from "../../../components/progress.js";
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { getUploadAvatarUrlRequest } from "../requests/get_upload_url_avatar.js";
import { saveAvatarRequest } from "../requests/save_avatar.js";

// Импортируем типы
import type { ChannelSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Выбор и загрузка аватара канала: открывает системный выбор файла,
 * прогоняет кроп, заливает оригинал в S3 и записывает аватар каналу.
 * Превью, цвета и LQIP создаёт сервер после save.
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function choosePhoto(form: ChannelSettings): Promise<void> {

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

            // Создаем Blob ссылку
            const blob = URL.createObjectURL(file);

            // Загружаем редактор фото (конструктор сам открывает кроппер,
            // результатом пользуется колбэк onSave)
            new ImageCropper({ imageUrl: blob }, {
                onSave: async (data) => {

                    try {

                        // Кроп по координатам кроппера на клиенте: getCropData
                        // уже вернул прямоугольник в натуральных пикселях
                        // исходника, вырезаем его на canvas
                        const cropped = await cropImage(file, data?.coords);

                        // Кропнут — значит webp. Имя приводим к расширению:
                        // сервер сверяет MIME с расширением, расхождение
                        // ведёт к MIME_EXTENSION_MISMATCH
                        const croppedName = file.name.replace(/\.[^.]+$/, "") + ".webp";

                        // Получаем пре-подписанную ссылку для загрузки в S3
                        const getUploadUrl = await getUploadAvatarUrlRequest({
                            channel_id: form.channelId,
                            file_name: croppedName,
                            // MIME и размер обязательны: сервер сверяет MIME с расширением,
                            // а размер подписывается в POST policy (без него — FILE_SIZE_REQUIRED)
                            mime_type: resolveMimeType(cropped),
                            size: cropped.size
                        });

                        // Создаем и настраиваем компонент прогресса
                        const progress = new ProgressIndicator({ width: "100%" });
                        const progressElement = progress.getElement();
                        form.avatar?.dom?.appendChild(progressElement);

                        // Переводим в состояние ожидания/обработки
                        progress.setProcessing();

                        // Грузим только оригинал: превью, цвета и LQIP создаёт
                        // сервер после save avatar, presigned-цели на производные
                        // больше не подписываются
                        await uploadDerivedAssets({
                            request: getUploadUrl.data,
                            blobs: matchBlobsToTargets(getUploadUrl.data.targets, [
                                { kind: "original", blob: cropped, mime_type: resolveMimeType(cropped) }
                            ]),
                            onProgress: ({ percent }) => {
                                progress.update(percent);
                            }
                        });

                        // Переводим прогрессбар в состояние обработки:
                        // загрузка в S3 завершена, идёт запись аватарки
                        progress.setProcessing();

                        // Записываем аватарку канала
                        const response = await saveAvatarRequest({
                            channel_id: form.channelId,
                            document_id: getUploadUrl.data.document_id
                        });

                        // Удаляем прогресс-бар с задержкой для плавности
                        setTimeout(() => {
                            if (progress) progress.destroy();
                        }, 1000);

                        // Аватар
                        form.avatar?.setImage(response.data);

                        // Toast
                        Toast.success(t("forms.channel_settings.toasts.success_avatar"));

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
                            // Не владелец канала — доступ запрещён
                            Toast.error(t("forms.channel_settings.toasts.access_denied"));
                        } else {
                            // Toast
                            Toast.error(t("forms.channel_settings.toasts.avatar_error"));
                        }
                    }

                }
            });

        };

        // Открываем диалог выбора файлов
        input.click();

    } catch (error) {
        Logger.error(error);

        // Прочая ошибка сервера
        Toast.error(t("api.errors.server_error"));
    }

}
