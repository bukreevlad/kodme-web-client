// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { abortUpload } from "../../../utils/network/abort_upload.js";
import { getErrorCode } from "../../../utils/helpers/error_util.js";
import { uploadDerivedAssets, matchBlobsToTargets } from "../../../utils/media/upload_derived_assets.js";
import { resolveMimeType } from "../../../utils/validation/file_validator.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { getUploadFileUrlRequest } from "../requests/get_upload_file_url.js";
import { saveFileRequest } from "../requests/save_file.js";
import type { GetUploadFileUrlData } from "../requests/get_upload_file_url.js";
import type { SaveFileData } from "../requests/save_file.js";

// Импортируем типы
import type { Cloud } from "../index.js";
import type { CloudItem } from "../types.js";

/**
 * ***************************************************************************
 * Загрузка выбранных файлов в текущую папку облака:
 * получаем пре-подписанный URL, заливаем файл и сохраняем в облако.
 * В режиме общего доступа файлы уходят в папку ссылки (нужен доступ write).
 * @param form - Экземпляр формы.
 * @param files - Выбранные файлы.
 * ***************************************************************************
 */
export async function uploadFiles(form: Cloud, files: FileList): Promise<void> {

    try {

        // Проходим по выбранным файлам
        for (const file of files) {
            await _uploadFile(form, file);
        }

    } catch (error) {
        Logger.error(error);
        Toast.error(window._lc.forms.cloud.toasts.upload_error);
    } finally {

        // Сбрасываем выбор файлов
        if (form.fileInput) form.fileInput.value = "";

    }

}

/**
 * ***************************************************************************
 * Загрузка одного файла с отображением прогресса и сохранением в облако:
 * элемент добавляется в хранилище текущего режима (своё облако или общий
 * доступ), для общего доступа в запросы передаётся id ссылки.
 * @param form - Экземпляр формы.
 * @param file - Файл.
 * ***************************************************************************
 */
async function _uploadFile(form: Cloud, file: File): Promise<void> {

    // Определяем режим: общий доступ по ссылке или своё облако
    let shared = form.mode === "shared";

    // Хранилище и текущая папка зависят от режима загрузки
    let store = shared ? form.sharedStore : form.store;

    // Для общего доступа корень ссылки — это папка самой ссылки
    let folderId = shared
        ? (form.sharedFolderId || form.sharedLink?.item?.id || null)
        : form.currentFolderId;

    // Временный id элемента (до ответа сервера)
    let tempId = `tmp_cloud_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Добавляем временный элемент с прогрессом в хранилище
    store.add({
        id: tempId,
        item_id: tempId,
        item_type: "file",
        name: file.name,
        file_name: file.name,
        size: file.size,
        is_uploading: true,
        _file: file
    });

    try {

        // Формируем данные запроса (общий доступ — папка внутри ссылки)
        let payload: GetUploadFileUrlData = {
            folder_id: folderId,
            file_name: file.name,
            // MIME обязателен: сервер сверяет его с расширением (см.
            // get_upload_url_attach.js — там же пояснение про резолвер)
            mime_type: resolveMimeType(file),
            size: file.size
        };

        // Для общего доступа дополнительно передаём id ссылки (нужен доступ write)
        if (shared) {
            payload.link_id = form.sharedLink?.id || null;
        }

        // Получаем пре-подписанную ссылку для загрузки в S3
        let getUploadUrl = await getUploadFileUrlRequest(payload);

        // Если сервер отклонил файл (например, расширение не в white-листе)
        if (!getUploadUrl?.status) {
            _showUploadError(getUploadUrl);
            store.remove(tempId);
            return;
        }

        // Загружаем файл. Отмена по клику прерывает все активные POST
        // (см. файл сверху: `__uploader__.destroy()` в file_item.ts).
        let uploadController = new AbortController();

        // Сохраняем ссылку на отмену в данных элемента (для кнопки отмены)
        let tempItem = store.get(tempId);
        if (tempItem) {
            tempItem.__uploader__ = {
                destroy: () => {
                    uploadController.abort();

                    // Сообщаем серверу об отмене: запись переходит в aborted.
                    // Best-effort: если сокет закрылся, запись подчистит TTL
                    abortUpload({ document_id: getUploadUrl.data.document_id }).catch(() => {});
                }
            };
        }

        // Загружаем только оригинал: превью, цвета и LQIP создаёт сервер
        // после save file, presigned-цели на производные больше не
        // подписываются. Прогресс суммарный по всем
        // целям и считается на клиенте из XHR — сервер в шкалу не участвует
        await uploadDerivedAssets({
            request: getUploadUrl.data,
            blobs: matchBlobsToTargets(getUploadUrl.data.targets, [
                { kind: "original", blob: file, mime_type: resolveMimeType(file) }
            ]),
            signal: uploadController.signal,
            onProgress: ({ percent }) => {

                // Обновляем прогресс во всех копиях элемента
                let item = store.get(tempId);
                item?.__progressInstances__?.forEach(p => p.update(percent));

            }
        });

        // Формируем данные сохранения (folder_id эхом из get upload file url)
        let savePayload: SaveFileData = {
            folder_id: getUploadUrl.data.folder_id,
            document_id: getUploadUrl.data.document_id
        };

        // Для общего доступа id ссылки — сервер повторно проверит право записи
        if (shared) {
            savePayload.link_id = form.sharedLink?.id || null;
        }

        // Сохраняем файл в облако
        let response = await saveFileRequest(savePayload);

        // Если файл сохранён
        if (response.status && response.data) {
            let { item, file: fileData } = response.data;

            // Собираем финальные данные элемента (в формате "get folder")
            let finalData: CloudItem = {
                ...fileData,
                id: item.id,
                item_id: item.id,
                document_id: item.document_id,
                parent_id: item.parent_id,
                name: item.name,
                item_type: "file",
                created_at: item.created_at
            };

            // Заменяем временный id на серверный
            store.replaceId(tempId, item.id);

            // Обновляем данные элемента
            store.update(item.id, finalData);

        } else {

            // Если сохранить не удалось — удаляем временный элемент
            store.remove(tempId);

        }

    } catch (error) {

        // Если загрузка отменена пользователем — удаляем элемент и не показываем ошибку
        let message = typeof error === "object" && error !== null && "message" in error
            ? String(error.message)
            : "";
        if (message.includes("aborted")) {
            store.remove(tempId);
            return;
        }

        // Хранилище отклонило запрос (400 от S3) — показываем причину прямо
        // здесь и не поднимаем ошибку наверх: там её поймал бы generic-тост
        if (getErrorCode(error) === "UPLOAD_REJECTED") {
            store.remove(tempId);
            Toast.error(window._lc.api.errors.upload_rejected);
            return;
        }

        // Удаляем временный элемент при ошибке
        store.remove(tempId);

        // Пробрасываем ошибку
        throw error;

    }

}

/**
 * ***************************************************************************
 * Отображение ошибки загрузки файла (по коду ошибки сервера).
 * @param response - Ответ сервера либо null.
 * ***************************************************************************
 */
function _showUploadError(response: unknown): void {

    // Код ошибки сервера (легаси-конверт ответа { error: { code } };
    // актуальный сервер отвечает ошибкой через reject — разбор сохранён
    // на случай легаси-ответа)
    let code = _getLegacyErrorCode(response);

    // Если расширение не разрешено — показываем соответствующее сообщение
    if (code === "124206") {
        Toast.error(window._lc.forms.cloud.toasts.invalid_extension);
    } else {
        Toast.error(window._lc.forms.cloud.toasts.upload_error);
    }

}

/**
 * Приватный: код ошибки из легаси-конверта ответа { error: { code } }.
 * @param response - Ответ сервера (unknown — сверяемся проверками).
 * @returns Код ошибки либо пустая строка.
 */
function _getLegacyErrorCode(response: unknown): string {

    if (typeof response !== "object" || response === null) return "";
    if (!("error" in response)) return "";

    let error = response.error;
    if (typeof error !== "object" || error === null) return "";
    if (!("code" in error)) return "";

    return typeof error.code === "string" ? error.code : "";

}
