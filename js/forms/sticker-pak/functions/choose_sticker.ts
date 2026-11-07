// Импортируем config
import { STICKERS_ALLOWED_EXTENSION, STICKERS_ALLOWED_MIME } from "../../../config/constants.js";
import { getLimits } from "../../../config/limits.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { resolveMimeType } from "../../../utils/validation/file_validator.js";
import { uploadDerivedAssets } from "../../../utils/media/upload_derived_assets.js";
import { getErrorCode } from "../../../utils/helpers/error_util.js";
import { parseError } from "../../../utils/network/parse_error.js";
import { getDeclension } from "../../../utils/string/declensions.js";

// Импортируем components
import { ProgressIndicator } from "../../../components/progress.js";
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { appendSticker } from "./append_sticker.js";

// Импортируем requests
import { getUploadStickerUrlRequest } from "../requests/get_upload_sticker_url.js";
import { saveStickerRequest } from "../requests/save_sticker.js";

// Импортируем типы
import type { StickerPak } from "../index.js";

/**
 * ***************************************************************************
 * Выбор и загрузка стикеров в пак: системный множественный выбор файлов,
 * клиентская проверка лимитов, presigned-загрузка оригиналов в S3 и запись
 * стикеров.
 *
 * Конвейер на каждый файл: `get upload sticker url` →
 * `uploadDerivedAssets` (только оригинал — производные у стикера нет) →
 * `save sticker`. Файлы обрабатываются последовательно: невалидный файл
 * пропускается с тостом, остальные продолжают загрузку. Формат (WEBP)
 * лежит в constants, числовые лимиты берутся из `getLimits()`
 * (config/limits.ts): пока ответ авторизации не принят, их ведёт сервер.
 *
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function chooseSticker(form: StickerPak): Promise<void> {

    try {

        // Лимиты авторизации: не приняты — проверки ведёт сервер
        const limits = getLimits();

        // Лимит пака исчерпан — файловый диалог даже не открываем
        if (limits && form.stickers.length >= limits.stickers.max_per_pak) {
            Toast.error(window._lc.forms.sticker_pak.toasts.limit_reached);
            return;
        }

        // Создаем инпут выбора файлов (множественный выбор — загрузка набора)
        const input = document.createElement("input");
        input.multiple = true;
        input.type = "file";
        input.accept = `${STICKERS_ALLOWED_MIME},${STICKERS_ALLOWED_EXTENSION}`;

        // Действие выбора файлов
        input.onchange = async () => {

            // Получаем выбранные файлы (чтение из инпута напрямую: event.target
            // типизирован как EventTarget и потребовал бы приведения типов)
            const files = Array.from(input.files ?? []);
            if (!files.length) return;

            // Прогресс живёт вне try — убирается в finally даже при ошибке
            let progress: ProgressIndicator | null = null;

            // Счётчик добавленных — итоговый тост показывает по нему
            let added = 0;

            try {

                // Единый индикатор прогресса на весь пакет файлов
                progress = new ProgressIndicator({ width: "50%" });
                form.progressSlot?.appendChild(progress.getElement());
                form.progressSlot?.classList.remove("hidden");
                progress.setProcessing();

                // Отмена загрузки при закрытии формы (AbortSignal рвёт все POST)
                const controller = new AbortController();
                form.uploadController = controller;

                // Загружаем файлы последовательно — прогресс и лимит пака
                // при параллельных запросах «прыгали» бы и гонялись между собой
                for (let index = 0; index < files.length; index++) {

                    const file = files[index];
                    if (!file) continue;

                    // Лимит пака исчерпан набором — дальше не обрабатываем
                    if (limits && form.stickers.length >= limits.stickers.max_per_pak) {
                        Toast.error(window._lc.forms.sticker_pak.toasts.limit_reached);
                        break;
                    }

                    // ---------- VALIDATE ----------

                    // Только WEBP: расширение и MIME (плохой файл пропускаем,
                    // остальные из выборки продолжают загрузку)
                    if (!file.name.toLowerCase().endsWith(STICKERS_ALLOWED_EXTENSION)
                        || resolveMimeType(file) !== STICKERS_ALLOWED_MIME
                    ) {
                        Toast.error(window._lc.forms.sticker_pak.toasts.invalid_format);
                        continue;
                    }

                    // Размер файла в пределах лимита
                    if (limits && file.size > limits.stickers.max_size_bytes) {
                        Toast.error(window._lc.forms.sticker_pak.toasts.too_big);
                        continue;
                    }

                    // Реальные размеры изображения (картинка обязана декодироваться)
                    const dimensions = await readImageDimensions(file);
                    if (!dimensions) {
                        Toast.error(window._lc.forms.sticker_pak.toasts.invalid_format);
                        continue;
                    }

                    // Стороны изображения в пределах лимита
                    if (limits && (dimensions.width > limits.stickers.max_dimension
                        || dimensions.height > limits.stickers.max_dimension)
                    ) {
                        Toast.error(window._lc.forms.sticker_pak.toasts.too_large_image);
                        continue;
                    }
                    // ---------- VALIDATE ----------

                    try {

                        // Пре-подписанная ссылка на загрузку в S3 (лимиты сервера —
                        // источник истины, но клиент их уже проверил выше)
                        const uploadUrl = await getUploadStickerUrlRequest({
                            pak_id: form.pakId,
                            file_name: file.name,
                            mime_type: resolveMimeType(file),
                            size: file.size,
                            metadata: {}
                        });

                        // Доля текущего файла в общем прогрессе пакета
                        const base = (index / files.length) * 100;
                        const span = 100 / files.length;

                        // Загружаем оригинал: путь берём из ответа сервера, а не
                        // собираем сами (тот же принцип, что у вложений)
                        const originalTarget = uploadUrl.data.targets.find((target) => target.kind === "original")
                            ?? uploadUrl.data.targets[0];
                        if (!originalTarget) throw new Error("Не выдана цель загрузки стикера");

                        await uploadDerivedAssets({
                            request: uploadUrl.data,
                            blobs: [{ path: originalTarget.path, blob: file, mime_type: resolveMimeType(file) }],
                            signal: controller.signal,
                            onProgress: ({ percent }) => progress?.update(base + (percent / 100) * span)
                        });

                        // Загрузка в S3 завершена — сервер проверяет объект и пишет стикер
                        progress.setProcessing();

                        const response = await saveStickerRequest({
                            pak_id: form.pakId,
                            document_id: uploadUrl.data.document_id
                        });

                        // Вставляем стикер в сетку и обновляем плашку пака в списке
                        if (response.data) {
                            appendSticker(form, {
                                sticker_id: response.data.sticker_id,
                                document_id: response.data.document_id,
                                file_token: response.data.file_token
                            });
                            added++;
                        }

                    } catch (error) {

                        // Отмена (закрытие формы) — выходим из всей выборки
                        if (getErrorCode(error) === "UPLOAD_ABORTED") return;

                        Logger.error("[app][sticker-pak][choose-sticker]:", error);

                        // Имя ошибки берём из разбора: у ApiError поле name —
                        // "ApiError", а имя вида MEDIA_PROCESSING_DISABLED
                        // лежит в message формата «ИМЯ :: код»
                        const info = parseError(error);

                        // Хранилище отклонило запрос (400 от S3, например
                        // пустое тело от Safari) — свой текст
                        if (info.code === "UPLOAD_REJECTED") {
                            Toast.error(window._lc.api.errors.upload_rejected);
                        } else if (info.name === "MEDIA_PROCESSING_DISABLED") {
                            // Обработка выключена конфигом
                            Toast.error(window._lc.api.errors.media_processing_disabled);
                        } else {
                            // Toast (коды ошибок сервера разбирает toastError)
                            Toast.error(window._lc.forms.sticker_pak.toasts.add_error);
                        }

                    }

                }

                // Итоговый тост: один файл — привычный текст, набор — со счётчиком
                if (added === 1) {
                    Toast.success(window._lc.forms.sticker_pak.toasts.success_add);
                } else if (added > 1) {
                    const forms = window._lc.forms.sticker_pak.toasts.dec_stickers;
                    Toast.success(`${window._lc.forms.sticker_pak.toasts.success_add_many}: ${added} ${getDeclension(added, forms)}`);
                }

            } finally {

                // Убираем прогресс и скрываем слот
                progress?.destroy();
                form.progressSlot?.classList.add("hidden");
                form.uploadController = null;

            }

        };

        // Открываем диалог выбора файлов
        input.click();

    } catch (error) {
        Logger.error("[app][sticker-pak][choose-sticker][open]:", error);

        // Прочая ошибка сервера
        Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
    }

}

/**
 * ***************************************************************************
 * Приватная: реальные размеры изображения из файла.
 *
 * createImageBitmap декодирует файл тем же движком, что и отрисовка:
 * битый или не-image файл даст ошибку — тогда стикер не сохраняется.
 * @param file - Выбранный файл.
 * @returns Размеры { width, height } или null, если файл не декодируется.
 * ***************************************************************************
 */
async function readImageDimensions(file: Blob): Promise<{ width: number; height: number } | null> {

    try {

        const bitmap = await createImageBitmap(file);
        const dimensions = { width: bitmap.width, height: bitmap.height };
        bitmap.close();

        return dimensions;

    } catch (error) {

        // Не-image или битый WEBP — вызывающий код покажет тост формата
        Logger.debug("[app][sticker-pak][read-image-dimensions]:", error);
        return null;

    }

}
