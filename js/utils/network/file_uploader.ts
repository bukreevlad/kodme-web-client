import { ApiError } from "./api_error.js";

// Импортируем utils
import { Logger } from "../logs/logger.js";

/**
 * Колбэк прогресса загрузки: получено байт, всего байт, процент.
 */
type UploadProgressCallback = (loaded: number, total: number, percent: number) => void;

/**
 * Цель загрузки из ответа сервера (presigned POST policy).
 */
interface UploadTarget {
    /** Адрес бакета. */
    url?: string;
    /** Поля политики, которые идут в multipart-форму. */
    fields?: Record<string, string>;
    /** MIME-тип файла. */
    mime_type?: string;
    /** Максимальный размер файла. */
    max_size?: number;
    /** Путь хранения объекта. */
    path?: string;
    /** Тип объекта. */
    kind?: string;
}

/**
 * Опции создания загрузчика.
 */
interface FileUploaderOptions {
    /** Цель загрузки (url + поля политики). */
    target?: UploadTarget | null;
    /** Blob/File инстанс. */
    file?: Blob | File | null;
    /** Колбэк прогресса загрузки. */
    callback?: UploadProgressCallback | null;
}

/**
 * Результат успешной загрузки (ответ S3).
 */
interface UploadResult {
    /** HTTP-статус ответа. */
    status: number;
    /** Тело ответа. */
    body: string;
    /** Заголовки ответа. */
    headers: string;
}

/**
 * Ссылки на обработчики событий XHR для последующего удаления.
 */
interface UploadEventHandlers {
    /** Прогресс загрузки. */
    progress?: ((event: ProgressEvent) => void | undefined) | undefined;
    /** Успешное завершение. */
    load?: (() => void) | undefined;
    /** Сетевая ошибка. */
    error?: (() => void) | undefined;
    /** Отмена загрузки. */
    abort?: (() => void) | undefined;
}

/**
 * ***************************************************************************
 * FileUploader - загрузка файла в S3 по presigned POST policy с отменой.
 *
 * Сервер выдаёт набор полей политики `{ url, fields }` — их отправляют
 * multipart-формой вместе с файлом, и S3 ДО записи проверяет путь/MIME/размер.
 * Отклонённые промисы несут код ошибки (UPLOAD_FAILED | UPLOAD_REJECTED |
 * UPLOAD_ABORTED | INVALID_FILE), чтобы очередь отправки различала
 * «отмена» и «сбой».
 * ***************************************************************************
 */
export class FileUploader {

    // Цель загрузки (url + поля политики)
    target: UploadTarget | null;

    // Загружаемый Blob/File
    file: Blob | File | null;

    // Колбэк прогресса загрузки
    callback: UploadProgressCallback | null;

    // Ссылка на экземпляр XHR (доступ снаружи для отмены)
    xhr: XMLHttpRequest | null;

    // Флаг отмены загрузки
    isAborted: boolean;

    // Ссылки на обработчики событий для последующего удаления
    eventHandlers: UploadEventHandlers;

    /**
     * ***************************************************************************
     * Класс для управления загрузкой файла по POST policy с возможностью отмены.
     * @param {FileUploaderOptions} [options] - Параметры (цель, файл, колбэк).
     * ***************************************************************************
     */
    constructor(options: FileUploaderOptions = {}) {
        this.target = options.target || null;
        this.file = options.file || null;
        this.callback = options.callback || ((loaded, total, percent) => { });

        // Храним ссылку на экземпляр XHR, чтобы иметь к нему доступ снаружи
        this.xhr = new XMLHttpRequest();
        this.isAborted = false;

        // Ссылки на обработчики событий для последующего удаления
        this.eventHandlers = {
            progress: undefined,
            load: undefined,
            error: undefined,
            abort: undefined
        }
    }

    /**
     * ***************************************************************************
     * Запускает процесс загрузки.
     * @returns {Promise<UploadResult>} - Ответ S3 (статус, тело, заголовки).
     * @throws {ApiError} С кодом `UPLOAD_FAILED` | `UPLOAD_REJECTED` | `UPLOAD_ABORTED` | `INVALID_FILE`.
     * ***************************************************************************
     */
    upload(): Promise<UploadResult> {
        return new Promise<UploadResult>((resolve, reject) => {
            const xhr = this.xhr;

            // Нельзя загрузить то, что не является Blob/File
            if (!(this.file instanceof Blob)) {
                this._cleanupEventListeners();
                this._reject(reject, new ApiError("Invalid file data (not a Blob/File)"), "INVALID_FILE");
                return;
            }

            // Без цели (url + поля политики) подписать запрос нечем
            if (!this.target?.url || !this.target?.fields) {
                this._cleanupEventListeners();
                this._reject(reject, new ApiError("Invalid upload target (url/fields required)"), "INVALID_FILE");
                return;
            }

            // XHR мог быть обнулён предыдущей отменой (abort/cleanup):
            // подписываться и настраивать запрос в таком состоянии нельзя
            if (!xhr) {
                this._cleanupEventListeners();
                this._reject(reject, new ApiError("Upload XHR is not available"), "UPLOAD_ABORTED");
                return;
            }

            // Прогресс загрузки
            this.eventHandlers.progress = (event) => {
                if (event.lengthComputable && !this.isAborted) {
                    const total = event.total;
                    const loaded = event.loaded;
                    const percent = total ? Math.round((loaded / total) * 100) : 0;
                    this.callback?.(loaded, total, percent);
                }
            };

            // Обработчик завершения. S3 отвечает 204, приёмка — любой 2xx:
            // опираемся на диапазон, а не на точный код.
            this.eventHandlers.load = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({
                        status: xhr.status,
                        body: xhr.responseText,
                        headers: xhr.getAllResponseHeaders()
                    });
                } else {

                    // Тело ответа хранилища (XML с причиной: MissingContentLength,
                    // IncompleteBody и т.п.) кладём в details — по нему ставится
                    // диагноз, например «Safari ушёл с Content-Length: 0»
                    const uploadError = new ApiError(`Upload failed with status ${xhr.status}`, {
                        status: xhr.status,
                        details: xhr.responseText
                    });

                    // Ошибку хранилища логируем сразу с телом: она редкая и
                    // требует причины, а не только статуса
                    Logger.error(`[app][upload]: хранилище ответило ${xhr.status}: ${xhr.responseText}`);

                    // Статус кладём на ошибку: загрузчик derived-объектов
                    // различает «сетевой сбой / 5xx — можно ретраить» и
                    // «4xx — ретраить бессмысленно, это баг клиента».
                    // 400 получает свой код: вызывающий код показывает по нему
                    // понятный тост (например, пустое тело запроса от Safari)
                    this._reject(reject, uploadError, xhr.status === 400 ? "UPLOAD_REJECTED" : "UPLOAD_FAILED");
                }
            };

            // Обработчики ошибок
            this.eventHandlers.error = () => this._reject(reject, new ApiError("File upload failed"), "UPLOAD_FAILED");
            this.eventHandlers.abort = () => this._reject(reject, new ApiError("File upload aborted"), "UPLOAD_ABORTED");

            // Подписываемся на события
            xhr.upload?.addEventListener("progress", this.eventHandlers.progress);
            xhr?.addEventListener("load", this.eventHandlers.load);
            xhr?.addEventListener("error", this.eventHandlers.error);
            xhr?.addEventListener("abort", this.eventHandlers.abort);

            // Собираем multipart-форму: поля политики + файл под ключом `file`.
            //
            // Порядок важен: S3 требует, чтобы `key` и подписанные поля шли
            // до файла, а сам файл — ПОСЛЕДНИМ. `FormData` сохраняет порядок
            // добавления, поэтому сначала все `fields`, потом файл.
            const formData = new FormData();
            for (const [name, value] of Object.entries(this.target.fields)) {
                formData.append(name, value);
            }

            // !!! ОБХОД WebKit Bug 319985 (Safari 26.5.x–27) — НЕ УДАЛЯТЬ,
            // пока фикс (PR WebKit/WebKit#75680) не доедет до релизов Safari.
            // Баг: XHR/fetch отправляет disk-backed File со страницей под
            // контролем Service Worker с пустым телом (Content-Length: 0),
            // S3 отвечает 400 MalformedPOSTRequest. Slice-представление не
            // имеет пути на диск, поэтому WebKit идёт безопасной веткой
            // сериализации. Обход безвреден во всех браузерах: байты не
            // копируются (ленивое окно над теми же данными), mime-тип и имя
            // части сохраняются.
            const sliced = this.file.slice(0, this.file.size, this.file.type);
            formData.append("file", sliced, this.file instanceof File ? this.file.name : undefined);

            // Настройка запроса. `Content-Type` не задаём руками: браузер
            // сам выставит `multipart/form-data; boundary=...` — S3 сверяет
            // именно boundary, и ручная подстановка его сломает.
            xhr.open("POST", this.target.url, true);
            xhr.send(formData);

        });
    }

    /**
     * ***************************************************************************
     * Прерывает загрузку.
     * ***************************************************************************
     */
    abort(): void {
        this.isAborted = true;
        if (this.xhr) {
            this.xhr.abort();
        }
    }

    /**
     * ***************************************************************************
     * Уничтожает объект, очищает ресурсы.
     * ***************************************************************************
     */
    destroy(): void {

        // Отменяем загрузку, если она идет
        this.abort();

        // Удаляем все обработчики событий
        this._cleanupEventListeners();

        // Очищаем ссылки на файл и callback для помощи сборщику мусора
        this.file = null;
        this.callback = null;
        this.target = null;
        this.xhr = null;
        this.eventHandlers = {};
    }

    /**
     * ***************************************************************************
     * Приватный метод: отклонить промис, проставив код ошибки.
     *
     * Зачем код: вызывающий код (очередь отправки сообщений, загрузчик
     * облака) обязан различать «пользователь отменил загрузку»
     * (UPLOAD_ABORTED — это не ошибка, цикл идёт к следующему файлу) и
     * «загрузка упала» (UPLOAD_FAILED — очередь надо остановить).
     * Раньше это различалось подстрокой «aborted» в тексте.
     * @param {(reason?: unknown) => void} reject - Функция отклонения промиса.
     * @param {ApiError} error - Объект ошибки.
     * @param {string} [code] - Машиночитаемый код ошибки.
     * @returns {void}
     * ***************************************************************************
     */
    _reject(reject: (reason?: unknown) => void, error: ApiError, code?: string): void {

        // Проставляем код на самой ошибке, чтобы её разобрал общий ParseError
        if (code) error.code = code;

        reject(error);

    }

    /**
     * ***************************************************************************
     * Приватный метод для очистки всех обработчиков событий.
     * ***************************************************************************
     */
    _cleanupEventListeners(): void {
        if (!this.xhr) return;

        // Удаляем все обработчики событий
        if (this.eventHandlers.progress) {
            this.xhr.upload.removeEventListener("progress", this.eventHandlers.progress);
        }
        if (this.eventHandlers.load) {
            this.xhr.removeEventListener("load", this.eventHandlers.load);
        }
        if (this.eventHandlers.error) {
            this.xhr.removeEventListener("error", this.eventHandlers.error);
        }
        if (this.eventHandlers.abort) {
            this.xhr.removeEventListener("abort", this.eventHandlers.abort);
        }
    }

}
