import { Logger } from "../logs/logger.js";
import { LocalStorage } from "../local_storage.js";
import { PlatformBridge } from "../platform.bridge.js";
import { ApiError } from "./api_error.js";

// Импортируем utils
import { getErrorName } from "../helpers/error_util.js";

/**
 * Колбэк прогресса скачивания: получено байт, всего байт, процент.
 */
type DownloadProgressCallback = (loaded: number, total: number, percent: number) => void;

/**
 * Статус скачивания, который присылает нативная Android-обёртка
 * (событие `AndroidDownloadEvent` на window).
 */
export type AndroidDownloadStatus = "PROGRESS" | "SUCCESS" | "ERROR" | "CANCELLED";

/**
 * Деталь события `AndroidDownloadEvent`: статус одной загрузки из нативного
 * менеджера загрузок Android-обёртки. Поля повторяют то, что шлёт обёртка
 * (id, status, message, loaded, total, percent).
 */
export interface AndroidDownloadMessage {

    /** Идентификатор загрузки (присваивается загрузчиком при старте). */
    id: string;

    /** Статус загрузки. */
    status: AndroidDownloadStatus;

    /** Сообщение статуса: текст ошибки, имя файла при успехе либо пустая строка. */
    message: string;

    /** Скачано байт. */
    loaded: number;

    /** Всего байт. */
    total: number;

    /** Процент загрузки. */
    percent: number;

}

/**
 * Опции создания загрузчика файла.
 */
interface FileDownloaderOptions {
    /** URL скачиваемого файла. */
    url?: string;
    /** Токен доступа к файлу. */
    file_token?: string | undefined;
    /** Имя сохраняемого файла. */
    file_name?: string | undefined;
    /** Колбэк прогресса скачивания. */
    callback?: DownloadProgressCallback;
}

/**
 * ***************************************************************************
 * FileDownloader - стриминг файла напрямую на диск через File System API,
 * запасной путь через Blob/<a> или нативный мост Android.
 * ***************************************************************************
 */
export class FileDownloader {

    // URL скачиваемого файла
    url: string;

    // Токен доступа к файлу
    fileToken: string | undefined;

    // Имя сохраняемого файла
    fileName: string;

    // Колбэк прогресса скачивания
    callback: DownloadProgressCallback;

    // Контроллер отмены запроса
    abortController: AbortController;

    // Идентификатор активной загрузки в Android-мосте
    androidDownloaderId: string | null;

    // Конструктор
    constructor(options: FileDownloaderOptions = {}) {
        this.url = options.url || "";
        this.fileToken = options.file_token;
        this.fileName = options.file_name || "downloaded_file";
        this.callback = options.callback || (() => { });
        this.abortController = new AbortController();
        this.androidDownloaderId = null;
    }

    /**
     * ***************************************************************************
     * Запускает процесс загрузки.
     * @returns {Promise<boolean>} - true по завершении.
     * ***************************************************************************
     */
    async download(): Promise<boolean> {

        try {

            // Проверка на платформу
            if (PlatformBridge.isAndroidDevice) {
                return await this._downloadAndroid();
            } else {
                return await this._downloadDesktop();
            }

        } catch (error) {

            if (getErrorName(error) === 'AbortError') {
                Logger.debug("Загрузка отменена");
                throw error;
            }

            Logger.error("Ошибка скачивания:", error);
            throw error;

        }

    }

    /**
     * ***************************************************************************
     * Логика для Desktop (Проверка поддержки и выбор метода).
     * @returns {Promise<boolean>} - true по завершении.
     * ***************************************************************************
     */
    async _downloadDesktop(): Promise<boolean> {
        if (window.showSaveFilePicker) {
            return await this._downloadWithFilePicker();
        } else {
            return await this._downloadFallback();
        }
    }

    /**
     * ***************************************************************************
     * Современный способ (Chrome, Edge) через File System Access API.
     * @returns {Promise<boolean>} - true по завершении.
     * ***************************************************************************
     */
    async _downloadWithFilePicker(): Promise<boolean> {

        // File System Access API поддерживают не все браузеры (Firefox/Safari):
        // вызывающий проверяет поддержку до вызова — здесь защита для типов
        if (!window.showSaveFilePicker) return false;

        // Без сессии авторизации заголовок запроса сформировать не из чего
        const session = LocalStorage.session;
        if (!session) throw new ApiError("Not authenticated");

        let writable: FileSystemWritableFileStream | null = null;

        try {

            const fileHandle = await window.showSaveFilePicker({ suggestedName: this.fileName });
            writable = await fileHandle.createWritable();

            const response = await fetch(this.url, {
                method: 'GET',
                signal: this.abortController.signal,
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "X-File-Token": `Bearer ${this.fileToken}`
                }
            });

            if (!response.ok) {
                throw new ApiError(`Server status: ${response.status}`, { status: response.status });
            }

            const total = parseInt(response.headers.get('content-length') || "0", 10);
            let loaded = 0;

            const progressTrackingStream = new TransformStream<Uint8Array, Uint8Array>({
                transform: (chunk, controller) => {
                    loaded += chunk.length;
                    const percent = total ? Math.round((loaded / total) * 100) : 0;
                    this.callback(loaded, total, percent);
                    controller.enqueue(chunk);
                }
            });

            // Тело ответа обязательно для потокового чтения
            if (!response.body) throw new ApiError("Empty response body");

            await response.body
                .pipeThrough(progressTrackingStream)
                .pipeTo(writable, { signal: this.abortController.signal });

            return true;

        } catch (err) {
            throw err;
        } finally {
            if (writable) {
                await writable.close().catch(() => { });
            }
        }

    }

    /**
     * ***************************************************************************
     * Запасной способ для Firefox / Safari (через Blob и тег <a>).
     * @returns {Promise<boolean>} - true по завершении.
     * ***************************************************************************
     */
    async _downloadFallback(): Promise<boolean> {

        // Без сессии авторизации заголовок запроса сформировать не из чего
        const session = LocalStorage.session;
        if (!session) throw new ApiError("Not authenticated");

        const response = await fetch(this.url, {
            method: 'GET',
            signal: this.abortController.signal,
            headers: {
                "Authorization": `Bearer ${session.access_token}`,
                "X-File-Token": `Bearer ${this.fileToken}`
            }
        });

        if (!response.ok) {
            throw new ApiError(`Server status: ${response.status}`, { status: response.status });
        }

        const total = parseInt(response.headers.get('content-length') || "0", 10);
        let loaded = 0;

        // Тело ответа может отсутствовать (теоретически для пустого ответа) —
        // читать в таком состоянии нечего, это ошибка, а не «скачано пустое»
        if (!response.body) throw new ApiError("Empty response body");

        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];

        try {

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                loaded += value.length;
                const percent = total ? Math.round((loaded / total) * 100) : 0;
                this.callback(loaded, total, percent);
            }

        } catch (err) {
            if (getErrorName(err) === 'AbortError') throw err;
            throw err;
        }

        // Создаем Blob из полученных чанков и инициируем скачивание браузером
        const blob = new Blob(chunks);
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = this.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Освобождаем память
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

        return true;

    }

    /**
     * ***************************************************************************
     * Логика для Android (Native File System).
     * @returns {Promise<boolean>} - true по завершении.
     * ***************************************************************************
     */
    async _downloadAndroid(): Promise<boolean> {

        // Без сессии авторизации заголовок запроса сформировать не из чего
        const session = LocalStorage.session;
        if (!session) throw new ApiError("Not authenticated");

        return new Promise<boolean>((resolve, reject) => {
            this.androidDownloaderId = "dl_" + Date.now() + "_" +
                Math.random().toString(36).slice(2);

            // payload
            const payload = {
                action: "DOWNLOAD_FILE",
                id: this.androidDownloaderId,
                url: this.url,
                fileName: this.fileName,
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "X-File-Token": `Bearer ${this.fileToken}`
                }
            };

            // Прослушиватель (тип события задан в WindowEventMap — см. globals)
            const handleAndroidMessage = (event: CustomEvent<AndroidDownloadMessage>): void => {
                const data = event.detail;
                if (!data || data.id !== this.androidDownloaderId) return;

                if (data.status === "PROGRESS") {
                    this.callback(data.loaded, data.total, data.percent);
                } else if (data.status === "SUCCESS") {
                    cleanup();
                    this.callback(data.loaded, data.total, data.percent);
                    resolve(true);
                } else if (data.status === "ERROR") {
                    cleanup();
                    reject(new Error(data.message || "Ошибка скачивания"));
                } else if (data.status === "CANCELLED") {
                    cleanup();
                    reject(new DOMException("Загрузка отменена", "AbortError"));
                }
            };

            // Удаляем прослушиватель
            const cleanup = (): void => {
                window.removeEventListener("AndroidDownloadEvent", handleAndroidMessage);
                this.abortController.signal.removeEventListener("abort", handleAbort);
                this.androidDownloaderId = null;
            };

            const handleAbort = (): void => {
                cleanup();
                reject(new DOMException("Загрузка отменена", "AbortError"));
            };

            // Прослушиватель
            window.addEventListener("AndroidDownloadEvent", handleAndroidMessage);
            this.abortController.signal.addEventListener("abort", handleAbort, { once: true });

            PlatformBridge.sendToAndroid(payload);
        });

    }

    /**
     * ***************************************************************************
     * Остановка загрузки.
     * ***************************************************************************
     */
    abort(): void {
        this.abortController.abort();
        if (this.androidDownloaderId && PlatformBridge.isAndroidDevice) {
            PlatformBridge.sendToAndroid({
                action: "CANCEL_DOWNLOAD",
                id: this.androidDownloaderId
            });
        }
    }

    /**
     * ***************************************************************************
     * Уничтожение загрузчика.
     * ***************************************************************************
     */
    destroy(): void {
        this.abort();
        this.callback = () => { };
    }

}
