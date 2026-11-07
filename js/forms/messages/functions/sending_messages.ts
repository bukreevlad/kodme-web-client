// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";
import { ApiError } from "../../../utils/network/api_error.js";
import { abortUpload } from "../../../utils/network/abort_upload.js";
import { parseError } from "../../../utils/network/parse_error.js";
import { toastError } from "../../../utils/ui/toast_error.js";
import { uploadDerivedAssets, matchBlobsToTargets } from "../../../utils/media/upload_derived_assets.js";
import * as Attachments from "../../../utils/messages/attachments.js";
import { resolveMimeType } from "../../../utils/validation/file_validator.js";

// Импортируем components
import { ProgressIndicator } from "../../../components/progress.js";
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { createMessageRequest } from "../requests/create_message.js";
import { getUploadAttachURLRequest } from "../requests/get_upload_url_attach.js";
import { saveAttachRequest } from "../requests/save_attach.js";

// Импортируем типы
import { isRecord } from "../../main/types.js";
import type { AttachmentsRaw } from "../../../utils/messages/attachments.js";
import type { MessageRecord } from "../types.js";
import type { Messages } from "../index.js";

/** Объект-мап вложений (тот же тип, что хранит MessageRecord.attachments). */
type AttachmentsMap = Extract<AttachmentsRaw, Record<string, unknown>>;

/** Элемент прогресса, на котором хранится обработчик отмены загрузки. */
type ProgressCancellable = HTMLElement & {

    /** Сохранённый обработчик click (снимается после успешной загрузки). */
    __onCancel__?: (event: Event) => void;

};

/** Ожидание ack одного исходящего сообщения. */
interface PendingAckGateway {

    /** Промис завершения ack — ждёт его обработчик эха `[message]: new`. */
    promise: Promise<void>;

    /** Разрешить ожидание ack (снимает блокировку пуша). */
    resolve: () => void;

}

/**
 * Формы, у которых цикл обработки очереди уже выполняется.
 *
 * Флаг form-scoped: глобальный блокировал отправку во всех открытых чатах
 * (Messages.instances может содержать несколько форм одновременно).
 * Хранится здесь, а не на форме: у экземпляра Messages нет поля isSending.
 */
const sendingForms = new WeakSet<Messages>();

/**
 * Промисы ожидания ack по локальному id исходящего.
 * Ключ — UUIDv7, уникален между формами; карта на форме хранит только
 * резолвер (контракт PendingAck), промис читается по ключам формы.
 */
const ackPromises = new Map<string, Promise<void>>();

/**
 * Коды валидационных отказов сервера: сообщение помечается ошибкой (можно
 * отредактировать и повторить), но очередь отправки продолжается.
 * Имена — коды ошибок сервера (секции send/update).
 */
const VALIDATION_ERRORS = new Set([
    // ---------- attachments ----------
    "ATTACHMENTS_MAX_COUNT_EXCEEDED",
    "MAX_FILES_EXCEEDED",
    "DOCUMENT_ID_INVALID",
    "DOCUMENT_ID_REQUIRED",
    // ---------- text ----------
    "TEXT_OR_ATTACHMENTS_REQUIRED",
    "TEXT_TOO_LONG",
    "INVALID_NAME",
    "INVALID_TEXT",
    // ---------- buttons ----------
    "BUTTONS_INVALID",
    "INVALID_BUTTONS",
    "BUTTONS_MAX_ROWS_EXCEEDED",
    "BUTTONS_MAX_PER_ROW_EXCEEDED",
    "BUTTON_TEXT_INVALID",
    "BUTTON_CLASSES_INVALID",
    "INVALID_BUTTON_URL"
]);

/**
 * Ошибки серверной обработки вложения (`save attach` и `send`): оригинал
 * в хранилище, но обработать его не удалось либо строка очереди не готова.
 * Текст тоста берёт toastError по имени ошибки (api.errors в локали).
 */
const MEDIA_ERRORS = new Set([
    "MEDIA_PROCESSING_FAILED",
    "DOCUMENT_NOT_FOUND",
    "OBJECT_NOT_UPLOADED",
    "UPLOAD_SIZE_MISMATCH",
    "DOCUMENT_NOT_PROCESSED"
]);

/** Ошибки отказа в загрузке: показываем причину, очередь продолжаем. */
const UPLOAD_ERRORS = new Set([
    // ---------- клиент (FileUploader) ----------
    "UPLOAD_FAILED",
    "UPLOAD_REJECTED",
    "INVALID_FILE",
    // ---------- сервер (get upload attach url) ----------
    "INVALID_EXTENSION",
    "INVALID_FILE_SIZE",
    "INVALID_MIME_TYPE",
    "MIME_TYPE_REQUIRED",
    "MIME_EXTENSION_MISMATCH",
    "INVALID_METADATA",
    "FILE_NAME_REQUIRED",
    "FILE_NAME_TOO_LONG",
    "FILE_SIZE_REQUIRED"
]);

/** Серверный код отказа → ключ локали (секция forms.messages.toasts). */
const UPLOAD_LOCALE: Record<string, string> = {
    INVALID_FILE_SIZE: "file_too_large",
    INVALID_EXTENSION: "invalid_extension",
    INVALID_MIME_TYPE: "invalid_mime",
    MIME_TYPE_REQUIRED: "invalid_mime",
    MIME_EXTENSION_MISMATCH: "invalid_mime"
};

/**
 * ***************************************************************************
 * Зарегистрировать ожидание ack-ответа сервера по исходящему сообщению.
 * Нужен, чтобы обработчик пуша `[message]: new` мог ДЕТЕРМИНИРОВАННО дождаться
 * ответа по нашему же сообщению (раньше использовался setTimeout(300) — это была
 * догадка, из-за которой на медленной сети всё равно возникал дубликат).
 * @param form - Экземпляр формы сообщений.
 * @param localId - Локальный id исходящего сообщения.
 * @returns Объект с промисом и функцией `resolve()`.
 * ***************************************************************************
 */
function registerPendingAck(form: Messages, localId: string): PendingAckGateway {

    // Карта живёт на форме: у каждой формы свой набор исходящих
    if (!form.pendingAcks) form.pendingAcks = new Map();

    // Создаём «шлюз»: промис резолвится, когда ack обработан (успех или ошибка)
    let resolveAck: () => void = () => {};
    const promise = new Promise<void>(res => { resolveAck = () => res(); });

    // Карта формы хранит только резолвер (контракт PendingAck);
    // промис ждёт в модульной карте — по нему работает awaitPendingAcks.
    const gateway = { promise, resolve: () => resolveAck() };
    form.pendingAcks.set(localId, gateway);
    ackPromises.set(localId, promise);

    return gateway;

}

/**
 * ***************************************************************************
 * Дождаться обработки ответов сервера по всем исходящим сообщениям формы.
 * Вызывается из обработчика `[message]: new`, когда эхо собственной отправки
 * пришло раньше ответа и в Store ещё нет сообщения с server id.
 * @param form - Экземпляр формы сообщений.
 * @param timeoutMs - Предохранительный таймаут (страховка от зависшего ack).
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function awaitPendingAcks(form: Messages, timeoutMs = 1500): Promise<void> {

    // Нет набора — отправка не идёт, ждать нечего
    const acks = form?.pendingAcks;
    if (!acks || acks.size === 0) return;

    // Собираем все ожидания этой формы (ключ формы = локальный id исходящего)
    const waits = Array.from(acks.keys())
        .map(localId => ackPromises.get(localId))
        .filter((promise): promise is Promise<void> => promise !== undefined);

    // Страховка: если ack «завис» (ответ не пришёл вовсе), не блокируем рендер навсегда
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<void>(resolve => {
        timerId = setTimeout(() => resolve(), timeoutMs);
    });

    try {
        await Promise.race([Promise.allSettled(waits), timeout]);
    } finally {
        // Без таймера останавливать нечего (здесь его всегда успевает создать
        // синхронный executor выше, guard лишь закрывает тип)
        if (timerId != null) clearTimeout(timerId);
    }

}

/**
 * ***************************************************************************
 * Основная функция обработки очереди сообщений (pending_messages).
 * Выполняет загрузку файлов на S3, подтверждение обработки и отправку сообщения.
 * @param form - Объект формы, содержащий store и контекст канала.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function sendingMessages(form: Messages): Promise<void> {

    // Проверка флага: если цикл этой формы уже выполняется — не запускаем новый.
    // Флаг form-scoped (см. sendingForms): глобальный блокировал отправку
    // во всех открытых чатах (Messages.instances может содержать несколько форм).
    if (sendingForms.has(form)) {
        return;
    }

    // Устанавливаем флаг активности и контроллер отмены для этой формы
    sendingForms.add(form);
    form.uploadAbort = new AbortController();
    Logger.debug("[app][messages]: Запущен цикл обработки pending_messages.");

    try {

        // Устанавливаем параметры
        let message: MessageRecord | null = null;

        // Основной цикл: Выполняется, пока есть сообщения в очереди
        while (message = await getNextPendingMessage()) {

            // Форма закрыта во время отправки — останавливаем очередь.
            // Отмена инициируется в _onBeforeClose() формы.
            if (form.uploadAbort?.signal?.aborted) {
                Logger.debug("[app][messages]: Цикл отправки прерван закрытием формы.");
                break;
            }

            // Локальный ID сообщения (из IndexedDB)
            const localId = message.id;

            // Регистрируем ожидание ack: обработчик пуша `[message]: new`
            // дождётся именно ответа по этому сообщению, а не угадывает тайминг
            const pendingAck = registerPendingAck(form, localId);

            try {

                // Если у сообщения есть файлы, требующие загрузки.
                // Проверяем через нормализатор: attachments — объект-мап по
                // temp_id до загрузки и по document_id после.
                if (Attachments.isNotEmpty(message?.attachments)) {
                    Logger.debug(`[app][messages]: Загрузка файлов сообщения с id:${localId} на сервер.`);

                    const finalAttachments: AttachmentsMap = {};
                    const messageStore = form.store.get(localId);

                    // invariant: запись очереди создаётся локально — вложения в ней
                    // всегда объект-мап (массив возможен только в ответе сервера)
                    const storeAttachments = (messageStore?.attachments ?? null) as AttachmentsMap | null;
                    const attachments = message.attachments as AttachmentsMap;

                    // Соответствие «локальный id файла → document_id на сервере»:
                    // по нему после цикла сверяется, что каждое оставшееся вложение
                    // реально загрузилось (см. проверку полноты набора ниже)
                    const documentIdByFileId: Record<string, string> = {};

                    // Получаем список ключей файлов для безопасной итерации
                    const fileIds = Attachments.toKeys(message.attachments);

                    // Проходим по файлам
                    for (const fileId of fileIds) {

                        // Проверка: не был ли файл удалён из объекта во время итерации
                        // (пользователь мог нажать «отмена» на прошлом файле)
                        if (!attachments[fileId]) continue;

                        // Ссылка на вложение в объекте сообщения (может исчезнуть
                        // при отмене — поэтому каждый раз перечитываем и падаем в continue)
                        let attach = attachments[fileId];

                        // Устанавливаем параметры
                        const abortController = new AbortController();

                        // Id документа появляется после ответа get upload url —
                        // нужен, чтобы на отмене сообщить серверу об отмене
                        // загрузки (abortUpload)
                        let uploadDocumentId: string | null = null;

                        // Фаза загрузки: пока оригинал в пути, отмена сообщает
                        // серверу. Дальше отмена только клиентская — строку в
                        // очереди подчистит sweep
                        let isUploading = true;

                        try {

                            // Массив для хранения экземпляров прогресса всех копий
                            const progressInstances: ProgressIndicator[] = [];

                            // Обработчик отмены загрузки пользователем
                            const onCancel = async () => {
                                Logger.debug(`[app][messages]: Пользователь прервал загрузку файла ${fileId}`);

                                // Прерываем активные POST. Загрузчик видит
                                // UPLOAD_ABORTED и идёт к следующему файлу.
                                abortController.abort();

                                // Сообщаем серверу об отмене только пока
                                // оригинал в пути (best-effort)
                                if (uploadDocumentId && isUploading) {
                                    abortUpload({ document_id: uploadDocumentId }).catch(() => {});
                                }

                                // Удаляем файл из текущего объекта в памяти
                                delete attachments[fileId];

                                // Чистим UI во всех копиях. Элемент мог быть уже удалён
                                // (отмена, trimWindow, закрытие формы) — поэтому optional chaining
                                if (storeAttachments?.[fileId]?.__progressInstances__) {
                                    storeAttachments[fileId].__progressInstances__.forEach((p: ProgressIndicator) => p.destroy());
                                    storeAttachments[fileId].__progressInstances__ = [];
                                }

                                if (storeAttachments?.[fileId]?.__domElements__) {
                                    storeAttachments[fileId].__domElements__.forEach(el => el && el.remove());
                                }

                                await removeAttachPendingMessage(localId, fileId);
                            };

                            // Безопасно получаем массив DOM элементов вложения для отображения прогресса
                            const domElements = storeAttachments?.[fileId]?.__domElements__;
                            if (Array.isArray(domElements)) {
                                domElements.forEach(attachElement => {
                                    if (!attachElement) return;

                                    const progressWrap = attachElement.querySelector("[data-progress-wrap]");

                                    // Создаем и настраиваем компонент прогресса для этой копии
                                    const progress = new ProgressIndicator({ width: "100%" });
                                    const progressElement: ProgressCancellable | null = progress.getElement();
                                    progressWrap && progressWrap.appendChild(progressElement);

                                    // Переводим в состояние ожидания/обработки
                                    progress && progress.setProcessing();

                                    // Сохраняем ссылку на обработчик прямо на элементе прогресса.
                                    // Раньше его снятие искалось по классу «progress-bar-element-selector-or-class»,
                                    // которого в разметке нет, поэтому listeners оставались висеть.
                                    progressElement && (progressElement.__onCancel__ = onCancel);

                                    // Навешиваем событие отмены на текущий элемент прогресса
                                    progressElement?.addEventListener("click", onCancel);

                                    // Сохраняем инстанс
                                    progressInstances.push(progress);
                                });
                            }

                            // Сохраняем массив инстансов в структуру вложения
                            if (storeAttachments?.[fileId]) {
                                storeAttachments[fileId].__progressInstances__ = progressInstances;
                            }

                            // invariant: в очереди файл ещё локальный — `_file` это
                            // оригинальный File с input
                            const sendMediaFile = (attach._file ?? attach) as File;
                            const sendMediaName = sendMediaFile.name || attach.name || "?";

                            // invariant: флаги категорий заметок кладёт
                            // медиа-процессор при импорте вложения
                            const rawFlags = attach?.metadata?.flags;
                            const flags = isRecord(rawFlags) ? rawFlags : {};

                            Logger.debug(
                                `[messages:send] подготовка вложения "${sendMediaName}" (${sendMediaFile.size} Б)`
                            );

                            // Получаем пре-подписанную ссылку для загрузки в S3.
                            // MIME берём через резолвер: для .fb2/.ai/.apk/.tar
                            // браузер отдаёт пустую строку, а сервер без MIME
                            // отвечает MIME_TYPE_REQUIRED. В metadata уходят только
                            // флаги заметок — категорию и обработку сервер определяет
                            // сам
                            const getUploadUrl = await getUploadAttachURLRequest({
                                channel_id: form.channelId,
                                // Поля опциональны в типе мапы, но заполняются
                                // при создании вложения — ?? лишь защищает тип
                                file_name: attach.name ?? "",
                                // MIME берём через резолвер, а не как `attach.type`:
                                // для .fb2/.ai/.apk/.tar браузер отдаёт пустую строку,
                                // а сервер без MIME отвечает MIME_TYPE_REQUIRED —
                                // то есть честно прикреплённый файл не загрузился бы
                                mime_type: resolveMimeType(sendMediaFile),
                                size: attach.size ?? 0,
                                metadata: {
                                    flags: {
                                        is_audio_note: flags.is_audio_note === true,
                                        is_video_note: flags.is_video_note === true
                                    }
                                }
                            });

                            Logger.debug(
                                `[messages:send] "${sendMediaName}": сервер выдал ${getUploadUrl?.data?.targets?.length ?? 0} целей, document_id=${getUploadUrl?.data?.document_id}`
                            );

                            // Проверка: не отменил ли пользователь загрузку, пока ждали ответ от API
                            if (!attachments[fileId]) continue;

                            // Id документа нужен для отмены загрузки по кнопке
                            // на прогресс-баре (abortUpload)
                            uploadDocumentId = getUploadUrl.data.document_id;

                            // Грузим только оригинал: превью и метадату создаёт
                            // сервер после save attach, presigned-цели на
                            // производные больше не подписываются. Упавший оригинал —
                            // фатальная ошибка, падает в catch ниже
                            const uploadStartedAt = performance.now();

                            Logger.debug(
                                `[messages:send] "${sendMediaName}": старт загрузки оригинала`
                            );

                            await uploadDerivedAssets({
                                request: getUploadUrl.data,
                                blobs: matchBlobsToTargets(getUploadUrl.data.targets, [
                                    { kind: "original", blob: sendMediaFile, mime_type: resolveMimeType(sendMediaFile) }
                                ]),
                                signal: abortController.signal,
                                onProgress: ({ percent }) => {
                                    // Обновляем шкалу прогресса во всех копиях UI
                                    storeAttachments?.[fileId]?.__progressInstances__
                                        ?.forEach((p: ProgressIndicator) => p.update(percent));

                                    // Сигнализируем о загрузке документа
                                    form.typingStatus.send({ action: "uploading_document" });
                                }
                            });

                            Logger.debug(
                                `[messages:send] "${sendMediaName}": загрузка завершена за ${Math.round(performance.now() - uploadStartedAt)} мс`
                            );

                            // Оригинал в хранилище — фаза загрузки закончилась,
                            // дальше отмена только клиентская (см. isUploading)
                            isUploading = false;

                            // Загрузка в S3 завершена: переводим прогрессбары
                            // во всех копиях в состояние обработки — индикатор
                            // без процентов, пока сервер генерирует производные
                            storeAttachments?.[fileId]?.__progressInstances__
                                ?.forEach((p: ProgressIndicator) => p.setProcessing());

                            // save attach: сервер проверяет оригинал и ждёт
                            // обработку (таймаут SOCKET_REQUEST_TIMEOUT_SAVE_ATTACH,
                            // 120 с). Гонка с отменой: отменённый файл не должен
                            // держать цикл до ответа сервера
                            Logger.debug(
                                `[messages:send] "${sendMediaName}": ожидание серверной обработки document_id=${getUploadUrl.data.document_id}`
                            );

                            const saveResult = await Promise.race([
                                saveAttachRequest({ document_id: getUploadUrl.data.document_id }),
                                waitForAbort(abortController.signal)
                            ]);

                            // Файл отменили, пока сервер его обрабатывал — идём дальше
                            if (!attachments[fileId]) continue;

                            // Деградация обработки: конвейер
                            // отработал неудачно, сообщение уйдёт документом без
                            // превью — сообщаем отправителю. При выключенном
                            // конфиге поле приходит без причины и молчим
                            if (saveResult.data.processed === false && saveResult.data.reason === "failed") {
                                Toast.info(window._lc.forms.messages.toasts.sent_without_preview, { position: "bottom-center" });
                            }

                            // Сохраняем данные для финальной отправки сообщения
                            finalAttachments[getUploadUrl.data.document_id] = {
                                file_name: attach.name
                            };

                            // Запоминаем соответствие «локальный файл → документ»
                            // для сверки полноты набора после цикла
                            documentIdByFileId[fileId] = getUploadUrl.data.document_id;

                            // Удаляем прогресс-бары всех копий с задержкой для плавности
                            setTimeout(() => {
                                if (storeAttachments?.[fileId]?.__progressInstances__) {
                                    storeAttachments[fileId].__progressInstances__.forEach((p: ProgressIndicator) => p.destroy());
                                    storeAttachments[fileId].__progressInstances__ = [];
                                }
                            }, 1000);

                            // Снимаем обработчик отмены со всех копий, так как
                            // файл загружен и обработан сервером.
                            // Ссылка на обработчик хранится на самом элементе прогресса.
                            storeAttachments?.[fileId]?.__domElements__?.forEach(attachElement => {
                                const progressElement = attachElement
                                    ?.querySelector<ProgressCancellable>("[data-progress-wrap]")
                                    ?.querySelector<ProgressCancellable>(".ui-progress-indicator");

                                if (progressElement?.__onCancel__) {
                                    progressElement.removeEventListener("click", progressElement.__onCancel__);
                                    delete progressElement.__onCancel__;
                                }
                            });

                        } catch (error) {

                            // Отмена загрузки — это не ошибка: файл уже удалён из
                            // сообщения обработчиком onCancel, идём к следующему.
                            // Различаем по коду (UPLOAD_ABORTED), а не по подстроке
                            // «aborted»: текст ошибки приходит из XHR-обработчиков.
                            const uploadError = parseError(error);

                            if (uploadError.code === "UPLOAD_ABORTED") {
                                Logger.debug("[app][messages][upload]: Загрузка отменена, переход к следующему файлу.");
                                continue;
                            }

                            // При возникновении сетевой ошибки пробрасываем её выше для остановки очереди
                            throw error;

                        }
                    }

                    // Сверяем полноту набора: каждое вложение, оставшееся в
                    // сообщении, обязано получить document_id — иначе сообщение
                    // ушло бы на сервер без части файлов
                    const missingFileIds = Attachments
                        .toKeys(message.attachments)
                        .filter(fileId => !documentIdByFileId[fileId]);

                    if (missingFileIds.length) {

                        Logger.error(
                            `[app][messages][sending][${localId}]: отправка прервана — ` +
                            `не загружены вложения: ${missingFileIds.join(", ")}`
                        );

                        // Помечаем сообщение ошибкой (пользователь увидит статус
                        // и сможет повторить), но очередь не останавливаем
                        const db = IndexedDB.db;
                        const failed = db ? await db.table<MessageRecord, string>("pending_messages").get(localId) : undefined;
                        if (failed && db) {
                            failed.is_error_sending = true;
                            await db.table<MessageRecord, string>("pending_messages").put(failed);
                            form.store.update(localId, failed);
                        }

                        Toast.warning(window._lc.forms.messages.toasts.uploading_failed, { position: "bottom-center" });

                        continue;

                    }

                    // Обновляем структуру вложений перед отправкой (заменяем локальные данные на серверные ID)
                    message.attachments = finalAttachments;

                }

                // Шаг Отправка готового сообщения на сервер
                Logger.debug(`[app][messages]: Отправка сообщения на сервер с id:${localId}.`);
                const response = await createMessageRequest(message);

                // ID сообщения, присвоенный сервером
                const serverId = response.data.message_id;
                Logger.debug(`[app][messages]: Сервер вернул serverId: ${serverId} для сообщения c localId: ${localId}. Начинаем replaceId.`);

                // Синхронизация: заменяем локальный ID на серверный в Store и IndexedDB.
                // Гонка: эхо `[message]: new` могло прийти раньше ответа и уже вставить
                // сообщение под serverId. В этом случае удаляем локальную копию и
                // сбрасываем pending-флаги у серверной, чтобы в DOM не осталось дубликата.
                if (form.store.get(serverId)) {

                    form.store.remove(localId);

                    // Патч собираем заранее: поле is_error_sending не входит в контракт
                    // записей стора (читается через индексную сигнатуру), поэтому
                    // литерал прямо в вызове update был бы избыточным свойством.
                    const syncFlags = { is_pending: false, is_temporary: false, is_error_sending: false };
                    form.store.update(serverId, syncFlags);
                    Logger.debug(`[app][messages]: Эхо пришло раньше ответа. Удалена локальная копия ${localId}, оставлена серверная ${serverId}.`);

                } else {

                    form.store.replaceId(localId, serverId);
                    Logger.debug(`[app][messages]: Выполнен form.store.replaceId(${localId} -> ${serverId}).`);

                }

                // Сообщение обработано сервером, больше не ждём его эхо
                form.pendingIds?.delete(localId);

                message.id = serverId;

                // Сообщение доставлено: снимаем локальные флаги, чтобы после перезагрузки
                // приложения оно не отображалось как "отправляющееся"
                message.is_pending = false;
                message.is_temporary = false;

                // Записываем сообщение в IndexedDB (база открыта раньше
                // работы с формами — guard лишь закрывает тип)
                const db = IndexedDB.db;
                if (db) await db.table<MessageRecord, string>("messages").put(message);
                Logger.debug(`[app][messages]: Сообщение сохраненно в IndexedDB под serverId: ${serverId}.`);

                // Удаляем сообщение из очереди исходящих
                await removePendingMessage(localId);

            } catch (error) {

                // Разбираем ошибку по коду (info.name/info.code), а не по
                // подстроке в тексте
                const info = parseError(error);

                // Нет доступа (например, бан в канале): сообщение отправить нельзя,
                // удаляем из очереди и из UI, но обязательно объясняем пользователю почему
                if (info.isAccessDenied) {

                    await removePendingMessage(localId);
                    form.store.remove(localId);

                    toastError(error, { context: `[app][messages][sending][${localId}]` });

                    // Очередь можно продолжать: это не сетевая ошибка
                    continue;

                }

                // null в Set не попадает (has(null) даёт false) — проверяем явно
                const isValidationError = (info.name != null && VALIDATION_ERRORS.has(info.name))
                    || (info.code != null && VALIDATION_ERRORS.has(info.code));

                // В случае технической ошибки помечаем сообщение для отображения статуса "Ошибка"
                const db = IndexedDB.db;
                const pendingMessage = db ? await db.table<MessageRecord, string>("pending_messages").get(localId) : undefined;
                if (pendingMessage && db) {
                    pendingMessage.is_error_sending = true;
                    await db.table<MessageRecord, string>("pending_messages").put(pendingMessage);
                    form.store.update(localId, pendingMessage);
                }

                // Отказ в загрузке: показываем точную причину (например,
                // «слишком большой»), а не общий текст
                if ((info.name != null && UPLOAD_ERRORS.has(info.name)) || (info.code != null && UPLOAD_ERRORS.has(info.code))) {

                    // Ключ локали для конкретного кода, если сервер его назвал
                    const specificKey = (info.name != null ? UPLOAD_LOCALE[info.name] : undefined)
                        || (info.code != null ? UPLOAD_LOCALE[info.code] : undefined);

                    // Локаль типизирована фиксированными ключами — копируем секцию
                    // в словарь для поиска по строке
                    const toasts: Record<string, string> = { ...window._lc?.forms?.messages?.toasts };

                    // Отклонение хранилищем (400 от S3, например пустое тело
                    // запроса от Safari) — свой текст вместо generic-ошибки
                    const isRejected = info.code === "UPLOAD_REJECTED" || info.name === "UPLOAD_REJECTED";
                    const text = specificKey
                        ? toasts[specificKey]
                        : (isRejected ? window._lc.api.errors.upload_rejected : null);

                    Toast.warning(text || window._lc.forms.messages.toasts.uploading_failed, { position: "bottom-center" });

                    // Причина внятная и очередь не встанет — продолжаем
                    if (specificKey) continue;

                } else {

                    // Причина не названа — общий тост по имени ошибки
                    toastError(error, { context: `[app][messages][sending][${localId}]` });

                }

                // Сетевые ошибки и таймауты останавливают очередь (следующему
                // без связи достанется тот же отказ), валидационные и ошибки
                // обработки медиа — нет
                const isMediaError = (info.name != null && MEDIA_ERRORS.has(info.name))
                    || (info.code != null && MEDIA_ERRORS.has(info.code));

                if (!isValidationError && !isMediaError) break;

            } finally {

                // Ack обработан (успех или ошибка) — освобождаем ожидающий пуш.
                // Если бы забыли, обработчик `[message]: new` ждал бы до таймаута.
                pendingAck.resolve();
                form.pendingAcks?.delete(localId);

                // Чистим модульную карту промисов (живёт под теми же ключами)
                ackPromises.delete(localId);

            }
        }

        if (!message) {
            Logger.debug("[app][messages]: Очередь пуста.");
        }

    } catch (error) {
        Logger.error("[app][messages]: Критическая ошибка цикла обработки очереди:", error);
    } finally {

        // Снимаем блокировку цикла (только своей формы)
        sendingForms.delete(form);

        // Контроллер отмены больше не нужен
        form.uploadAbort = null;

    }

}

/**
 * ***************************************************************************
 * Удаляет сообщение из очереди исходящих (IndexedDB).
 * @param messageId - ID сообщения.
 * @returns Promise<void>
 * ***************************************************************************
 */
async function removePendingMessage(messageId: string): Promise<void> {
    const db = IndexedDB.db;
    if (!db) return;
    await db.table<MessageRecord, string>("pending_messages").delete(messageId);
    Logger.debug(`[app][messages]: Сообщение ${messageId} удалено из pending_messages.`);
}

/**
 * ***************************************************************************
 * Удаляет конкретный файл из вложений сообщения в очереди (IndexedDB).
 * @param messageId - ID сообщения.
 * @param fileId - Локальный ID файла.
 * @returns Promise<void>
 * ***************************************************************************
 */
async function removeAttachPendingMessage(messageId: string, fileId: string): Promise<void> {
    const db = IndexedDB.db;
    if (!db) return;
    const message = await db.table<MessageRecord, string>("pending_messages").get(messageId);
    // invariant: запись очереди создаётся локально — вложения в ней всегда
    // объект-мап по fileId, массив возможен только в ответе сервера
    if (message && message.attachments && !Array.isArray(message.attachments)) {
        delete message.attachments[fileId];
        await db.table<MessageRecord, string>("pending_messages").put(message);
        Logger.debug(`[app][messages]: Файл ${fileId} удален из вложений сообщения ${messageId}.`);
    }
}

/**
 * ***************************************************************************
 * Получает первое доступное сообщение из очереди, которое не помечено как ошибочное.
 * @returns Запись очереди либо null, когда очередь пуста.
 * ***************************************************************************
 */
async function getNextPendingMessage(): Promise<MessageRecord | null> {
    const db = IndexedDB.db;
    if (!db) return null;
    // .first() отдаёт undefined для пустой очереди — нормализуем к null
    return (await db.table<MessageRecord, string>("pending_messages")
        .filter((msg: MessageRecord) => !msg.is_error_sending)
        .first()) ?? null;
}

/**
 * ***************************************************************************
 * Дождаться отмены текущего файла: промис отклоняется с кодом
 * `UPLOAD_ABORTED`, как только пользователь снял файл (обработчик onCancel).
 *
 * Нужен для гонки с `save attach`: запрос серверной обработки нельзя прервать,
 * а цикл по файлам не должен стоять из-за отмены до ответа сервера (до 120 с).
 *
 * @param signal - Сигнал отмены текущего файла.
 * @returns Промис, отклоняющийся при отмене.
 * ***************************************************************************
 */
function waitForAbort(signal: AbortSignal): Promise<never> {

    return new Promise<never>((_, reject) => {

        // Отмена уже случилась — отклоняем сразу, без ожидания события
        if (signal.aborted) {
            reject(new ApiError("File upload aborted", { code: "UPLOAD_ABORTED" }));
            return;
        }

        // Ждём снятие файла; контроллер у файла свой, поэтому слушатель
        // не живёт дольше итерации по этому файлу
        signal.addEventListener("abort", () => {
            reject(new ApiError("File upload aborted", { code: "UPLOAD_ABORTED" }));
        }, { once: true });

    });

}
