// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { FileDownloader } from "../../../utils/network/file_downloader.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

/**
 * Данные файла для скачивания через storage API.
 */
export interface DownloadFileData {

    /** Id документа (для storage URL). */
    document_id?: string | undefined;

    /** Id элемента (fallback для storage URL, если document_id нет). */
    id?: string;

    /** Токен доступа к файлу. */
    token?: string;

    /** Оригинальное имя файла. */
    file_name?: string;

    /** Имя элемента (сервер может отдать null, например у папки). */
    name?: string | null | undefined;

}

/**
 * ***************************************************************************
 * Скачивание файла через storage API (с токеном доступа к файлу).
 * @param data - Данные файла (document_id, file_name, token).
 * ***************************************************************************
 */
export async function downloadFileHandler(data: DownloadFileData): Promise<void> {

    try {

        // Id документа (для storage URL); если поле отсутствует — берём id
        let documentId = data.document_id || data.id;

        // Создаём загрузчик
        let downloader = new FileDownloader({
            url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${documentId}`,
            file_token: data.token,
            file_name: data.file_name || data.name || "file"
        });

        // Запускаем скачивание
        await downloader.download();
        downloader.destroy();

    } catch (error) {

        // Если загрузка не была отменена пользователем — выводим ошибку
        let name = typeof error === "object" && error !== null && "name" in error
            ? String(error.name)
            : "";
        if (name !== "AbortError") {
            Logger.error(error);

            // Toast
            Toast.error(window._lc.forms.cloud.toasts.download_error);
        }

    }

}
