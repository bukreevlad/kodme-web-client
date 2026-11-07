// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
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
import { createCommentRequest } from "../requests/create_comment.js";
import { getUploadUrlAttachRequest } from "../requests/get_upload_url_attach.js";
import { saveAttachRequest } from "../requests/save_attach.js";

// Импортируем типы
import { isRecord } from "../../main/types.js";
import type { CommentRecord } from "../types.js";
import type { Comments } from "../index.js";
import { I18n, t } from "../../../utils/i18n/index.js";

/** Локальная форма мапы вложений (массив возможен только в ответе сервера). */
type AttachmentsMap = Extract<Attachments.AttachmentsRaw, Record<string, unknown>>;

/** Элемент прогресса, на котором хранится обработчик отмены загрузки. */
type ProgressCancellable = HTMLElement & {

    /** Сохранённый обработчик click (снимается после успешной загрузки). */
    __onCancel__?: (event: Event) => void;

};

/** Формы, у которых цикл очереди уже запущен (защита от двойного цикла). */
const sendingForms = new WeakSet<Comments>();

/** Ожидания ack по локальному id комментария (снимает зависшие пуш-обработчики). */
const ackPromises = new Map<string, Promise<void>>();

/**
 * Ожидание ack (структура копии PendingAck из types.ts — резолв-хук).
 */
interface PendingAckLike {
    resolve: () => void;
}

/**
 * ***************************************************************************
 * Регистрация ожидания ack исходящего комментария.
 *
 * Обработчик пуша `[comment]: new` сверяет эхо с pending-очередью и
 * может дождаться исхода отправки, прежде чем решать, дубль это или нет.
 * @param form - Экземпляр формы.
 * @param id - Локальный id комментария.
 * @returns Объект ожидания (resolve вызывается в finally цикла).
 * ***************************************************************************
 */
export function registerPendingAck(form: Comments, id: string): PendingAckLike {

    // Резолв присваивается синхронно в конструкторе Promise — до первого
    // вызова resolve гарантированно заполнен
    let resolveAck: () => void = () => { };
    const pendingAck: PendingAckLike = {
        resolve: () => resolveAck()
    };

    // Промис разрешается в finally цикла — до закрытия формы его не дождаться
    const promise = new Promise<void>((resolve) => {
        resolveAck = resolve;
    });

    if (!form.pendingAcks) form.pendingAcks = new Map();
    form.pendingAcks.set(id, pendingAck);
    ackPromises.set(id, promise);

    return pendingAck;

}

/**
 * ***************************************************************************
 * Дождаться исхода всех текущих отправок формы (успех либо ошибка).
 * @param form - Экземпляр формы.
 * @returns Promise с результатами всех ожиданий.
 * ***************************************************************************
 */
export function awaitPendingAcks(form: Comments): Promise<unknown> {
    return Promise.allSettled([...ackPromises.values()]);
}

/**
 * ***************************************************************************
 * sendingComments - цикл отправки очереди исходящих комментариев.
 *
 * В отличие от формы сообщений очередь живёт ТОЛЬКО в памяти Store
 * (без IndexedDB): кандидат — запись с is_sending без
 * is_error_sending. После перезагрузки приложения неотправленные комментарии
 * не восстанавливаются.
 *
 * Порядок обработки: загрузка вложений на S3 (presigned-URL) → `[comment]: send`
 * → смена локального id на серверный (replaceId) либо снятие дубля, если эхо
 * `[comment]: new` пришло раньше ответа.
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function sendingComments(form: Comments): Promise<void> {

    // Если формы нет или цикл уже запущен для этой формы
    if (!form || sendingForms.has(form)) return;
    sendingForms.add(form);

    try {

        // Контроллер отмены текущих загрузок (закрытие формы / повторная отправка)
        form.uploadAbort = new AbortController();

        // Следующее pending-сообщение из Store
        let comment: CommentRecord | null = null;

        while ((comment = await getNextPendingComment(form))) {

            const localId = comment.id;

            // Регистрируем ожидание ack (пуш-обработчики Этапа 7 ждут исхода)
            const pendingAck = registerPendingAck(form, localId);

            try {

                // Шаг Загрузка вложений на сервер (если есть)
                if (Attachments.isNotEmpty(comment.attachments)) {
                    Logger.debug(`[app][comments]: Загрузка файлов комментария с id:${localId} на сервер.`);

                    const finalAttachments: AttachmentsMap = {};
                    const commentStore = form.store.get(localId);

                    // invariant: запись очереди создаётся локально — вложения в ней
                    // всегда объект-мап (массив возможен только в ответе сервера)
                    const storeAttachments = (commentStore?.attachments ?? null) as AttachmentsMap | null;
                    const attachments = comment.attachments as AttachmentsMap;

                    // Соответствие «локальный id файла → id документа на сервере»:
                    // цикл дошёл до конца ≠ загрузились все файлы (файл мог выпасть
                    // из attachments по отмене) — сверяем полноту набора ниже
                    const documentIdByFileId: Record<string, string> = {};

                    // Получаем список ключей файлов для безопасной итерации
                    const fileIds = Attachments.toKeys(comment.attachments);

                    // Проходим по файлам
                    for (const fileId of fileIds) {

                        // Проверка: не был ли файл удалён из объекта во время итерации
                        if (!attachments[fileId]) continue;

                        // Ссылка на вложение в объекте комментария (может исчезнуть
                        // при отмене — поэтому каждый раз перечитываем)
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
                                Logger.debug(`[app][comments]: Пользователь прервал загрузку файла ${fileId}`);

                                // Прерываем активные POST. Загрузчик видит
                                // UPLOAD_ABORTED и идёт к следующему файлу
                                abortController.abort();

                                // Сообщаем серверу об отмене только пока
                                // оригинал в пути (best-effort)
                                if (uploadDocumentId && isUploading) {
                                    abortUpload({ document_id: uploadDocumentId }).catch(() => {});
                                }

                                // Удаляем файл из текущего объекта в памяти
                                delete attachments[fileId];

                                // Чистим UI во всех копиях (элемент мог быть уже удалён)
                                if (storeAttachments?.[fileId]?.__progressInstances__) {
                                    storeAttachments[fileId].__progressInstances__.forEach((p: ProgressIndicator) => p.destroy());
                                    storeAttachments[fileId].__progressInstances__ = [];
                                }

                                if (storeAttachments?.[fileId]?.__domElements__) {
                                    storeAttachments[fileId].__domElements__.forEach(el => el && el.remove());
                                }
                            };

                            // Безопасно получаем DOM элементы вложения для отображения прогресса
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

                                    // Сохраняем ссылку на обработчик прямо на элементе прогресса
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

                            // Получаем пре-подписанную ссылку для загрузки в S3:
                            // адресат контракта — entity_id/entity_type поста.
                            // В metadata уходят только флаги заметок — категорию
                            // и обработку сервер определяет сам
                            const getUploadUrl = await getUploadUrlAttachRequest({
                                entity_id: form.postId,
                                entity_type: "message",
                                // MIME берём через резолвер: для .fb2/.ai/.apk/.tar
                                // браузер отдаёт пустую строку
                                file_name: attach.name ?? "",
                                mime_type: resolveMimeType(sendMediaFile),
                                size: attach.size ?? 0,
                                metadata: {
                                    flags: {
                                        is_audio_note: flags.is_audio_note === true,
                                        is_video_note: flags.is_video_note === true
                                    }
                                }
                            });

                            // Проверка: не отменил ли пользователь загрузку, пока ждали ответ от API
                            if (!attachments[fileId]) continue;

                            // Id документа нужен для отмены загрузки по кнопке
                            // на прогресс-баре (abortUpload)
                            uploadDocumentId = getUploadUrl.data.document_id;

                            // Загружаем только оригинал: превью и метадату
                            // создаёт сервер после save attach, presigned-цели
                            // на производные больше не подписываются
                            Logger.debug(
                                `[comments:send] "${sendMediaName}": старт загрузки оригинала`
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
                                }
                            });

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
                                `[comments:send] "${sendMediaName}": ожидание серверной обработки document_id=${getUploadUrl.data.document_id}`
                            );

                            const saveResult = await Promise.race([
                                saveAttachRequest({ document_id: getUploadUrl.data.document_id }),
                                waitForAbort(abortController.signal)
                            ]);

                            // Файл отменили, пока сервер его обрабатывал — идём дальше
                            if (!attachments[fileId]) continue;

                            // Деградация обработки: конвейер
                            // отработал неудачно, комментарий уйдёт документом без
                            // превью — сообщаем отправителю. При выключенном
                            // конфиге поле приходит без причины и молчим
                            if (saveResult.data.processed === false && saveResult.data.reason === "failed") {
                                Toast.info(t("forms.comments.toasts.sent_without_preview"), { position: "bottom-center" });
                            }

                            // Сохраняем данные для финальной отправки комментария:
                            // локальную метадату переносим в мап ack'а, серверная
                            // гидратация придёт эхом [comment]: new и заменит
                            // запись целиком
                            finalAttachments[getUploadUrl.data.document_id] = {
                                document_id: getUploadUrl.data.document_id,
                                file_name: attach.name,
                                // spread вместо «metadata: ...»: поле обязуется
                                // только когда метадата есть (exactOptionalPropertyTypes)
                                ...(attach.metadata ? { metadata: attach.metadata } : {})
                            };

                            // Запоминаем соответствие «локальный файл → документ»
                            documentIdByFileId[fileId] = getUploadUrl.data.document_id;

                            // Удаляем прогресс-бары всех копий с задержкой для плавности
                            setTimeout(() => {
                                if (storeAttachments?.[fileId]?.__progressInstances__) {
                                    storeAttachments[fileId].__progressInstances__.forEach((p: ProgressIndicator) => p.destroy());
                                    storeAttachments[fileId].__progressInstances__ = [];
                                }
                            }, 1000);

                            // Снимаем обработчик отмены со всех копий
                            // (файл загружен и обработан сервером)
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
                            // комментария обработчиком onCancel, идём к следующему
                            const uploadError = parseError(error);

                            if (uploadError.code === "UPLOAD_ABORTED") {
                                Logger.debug("[app][comments][upload]: Загрузка отменена, переход к следующему файлу.");
                                continue;
                            }

                            // При возникновении сетевой ошибки пробрасываем её выше
                            // для остановки очереди
                            throw error;

                        }
                    }

                    // ---------- ПРОВЕРКА ПОЛНОТЫ НАБОРА ----------
                    // Файл мог выпасть из attachments уже после получения ссылки,
                    // но до конца загрузки — тогда набор неполный, и отправлять
                    // комментарий без части файлов нельзя
                    const missingFileIds = Attachments
                        .toKeys(comment.attachments)
                        .filter(fileId => !documentIdByFileId[fileId]);

                    if (missingFileIds.length) {

                        Logger.error(
                            `[app][comments][sending][${localId}]: отправка прервана — ` +
                            `не загружены вложения: ${missingFileIds.join(", ")}`
                        );

                        // Помечаем комментарий ошибкой (пользователь увидит статус),
                        // но очередь НЕ останавливаем: проблема в конкретном файле
                        form.store.update(localId, { is_error_sending: true });
                        Toast.warning(t("forms.comments.toasts.uploading_failed"), { position: "bottom-center" });

                        continue;

                    }
                    // ---------- ПРОВЕРКА ПОЛНОТЫ НАБОРА ----------

                    // Обновляем структуру вложений перед отправкой
                    comment.attachments = finalAttachments;

                }

                // Шаг Отправка готового комментария на сервер
                Logger.debug(`[app][comments]: Отправка комментария на сервер с id:${localId}.`);

                const response = await createCommentRequest({
                    entity_id: form.postId,
                    entity_type: "message",
                    text: comment.text ?? "",
                    reply_to_comment_id: comment.reply_to_comment_id ?? null,
                    // invariant: запись из очереди — локальная, вложения всегда мап
                    attachments: Attachments.isNotEmpty(comment.attachments) ? comment.attachments as Record<string, unknown> : null
                });

                // ID комментария, присвоенный сервером
                const serverId = response.data.comment_id;
                Logger.debug(`[app][comments]: Сервер вернул serverId: ${serverId} для комментария c localId: ${localId}.`);

                // Синхронизация: заменяем локальный ID на серверный.
                // Гонка: эхо `[comment]: new` могло прийти раньше ответа и уже
                // вставить комментарий под serverId — тогда снимаем локальную копию
                if (form.store.get(serverId)) {

                    form.store.remove(localId);

                    // Патч собираем заранее: литерал прямо в вызове update был бы
                    // избыточным свойством (exactOptionalPropertyTypes)
                    const syncFlags = { is_sending: false, is_error_sending: false };
                    form.store.update(serverId, syncFlags);
                    Logger.debug(`[app][comments]: Эхо пришло раньше ответа. Удалена локальная копия ${localId}, оставлена серверная ${serverId}.`);

                } else {

                    form.store.replaceId(localId, serverId);

                    // Снимаем флаги отправки у серверной записи (item::updated
                    // обновляет строку в ленте)
                    const syncFlags = { is_sending: false, is_error_sending: false };
                    form.store.update(serverId, syncFlags);
                    Logger.debug(`[app][comments]: Выполнен form.store.replaceId(${localId} -> ${serverId}).`);

                }

                // Черновик (если это он) больше не актуален
                if (form.tempComment?.id === localId) form.tempComment = null;

                // Комментарий доставлен — снимаем локальные флаги
                comment.id = serverId;
                comment.is_sending = false;

                // Локальный id больше не ждёт эхо: убираем его из реестра
                // pendingIds (им пользуется сверка в обработчике пуша
                // `[comment]: new` и пауза опроса реакций)
                form.pendingIds?.delete(localId);

                // Свое сообщение уже в Store с серверным id — двигаем позицию
                // чтения на него, иначе при следующем открытии ветка снова
                // покажет разделитель «Новые комментарии» для нашего же
                // комментария (в Messages позицию двигает intersection, у нас
                // строка уже видима и не пересекается заново после replaceId)
                form.lastViewedBatcher?.schedule(serverId);

            } catch (error) {

                // Разбираем ошибку по коду, а не по подстроке в тексте
                const info = parseError(error);

                // Комментарий больше отправить нельзя (комментирование выключено,
                // нет подписки, пост удалён): убираем из очереди и из UI,
                // но обязательно объясняем пользователю почему
                const isGone = info.isAccessDenied
                    || (info.name != null && COMMENT_GONE_ERRORS.has(info.name))
                    || (info.code != null && COMMENT_GONE_ERRORS.has(info.code));

                if (isGone) {

                    form.store.remove(localId);
                    form.pendingIds?.delete(localId);
                    if (form.tempComment?.id === localId) form.tempComment = null;

                    toastError(error, { context: `[app][comments][sending][${localId}]` });

                    // Очередь можно продолжать: это не сетевая ошибка
                    continue;

                }

                // Имена сверяются с кодами ошибок сервера при отправке комментария
                const isValidationError = (info.name != null && VALIDATION_ERRORS.has(info.name))
                    || (info.code != null && VALIDATION_ERRORS.has(info.code));

                // В случае ошибки помечаем комментарий для отображения статуса "Ошибка"
                form.store.update(localId, { is_error_sending: true });
                if (form.tempComment?.id === localId) form.tempComment.is_error_sending = true;

                // Отказ в загрузке: показываем точную причину (например,
                // «слишком большой»), а не общий текст
                if ((info.name != null && UPLOAD_ERRORS.has(info.name)) || (info.code != null && UPLOAD_ERRORS.has(info.code))) {

                    // Ключ локали для конкретного кода, если сервер его назвал
                    const specificKey = (info.name != null ? UPLOAD_LOCALE[info.name] : undefined)
                        || (info.code != null ? UPLOAD_LOCALE[info.code] : undefined);

                    // Локаль типизирована фиксированными ключами — копируем секцию
                    const toasts: Record<string, string> = { ...I18n.tree.forms.comments.toasts };

                    // Отклонение хранилищем (400 от S3, например пустое тело
                    // запроса от Safari) — свой текст вместо generic-ошибки
                    const isRejected = info.code === "UPLOAD_REJECTED" || info.name === "UPLOAD_REJECTED";
                    const text = specificKey
                        ? toasts[specificKey]
                        : (isRejected ? t("api.errors.upload_rejected") : null);

                    Toast.warning(text || toasts.uploading_failed || t("forms.comments.toasts.uploading_failed"), { position: "bottom-center" });

                    // Причина внятная и очередь не встанет — продолжаем
                    if (specificKey) continue;

                } else {

                    // Показываем причину
                    toastError(error, { context: `[app][comments][sending][${localId}]` });

                }

                // Ошибки обработки медиа очередь тоже не останавливают: следующий
                // комментарий отправится, а текущий останется со статусом ошибки
                const isMediaError = (info.name != null && MEDIA_ERRORS.has(info.name))
                    || (info.code != null && MEDIA_ERRORS.has(info.code));

                // Сетевые ошибки и таймауты останавливают очередь: следующему
                // комментарию без связи достанется тот же отказ. Валидационные
                // и ошибки обработки медиа — нет.
                if (!isValidationError && !isMediaError) break;

            } finally {

                // Ack обработан (успех или ошибка) — освобождаем ожидающий пуш
                pendingAck.resolve();
                form.pendingAcks?.delete(localId);

                // Чистим модульную карту промисов (живёт под теми же ключами)
                ackPromises.delete(localId);

            }
        }

    } catch (error) {
        Logger.error("[app][comments][sending]: Критическая ошибка цикла обработки очереди:", error);
    } finally {

        // Снимаем блокировку цикла (только своей формы)
        sendingForms.delete(form);

        // Контроллер отмены больше не нужен
        form.uploadAbort = null;

    }

}

/**
 * ***************************************************************************
 * Получить первый комментарий из очереди Store, который не помечен ошибочным.
 * @param form - Экземпляр формы.
 * @returns Запись очереди либо null, когда очередь пуста.
 * ***************************************************************************
 */
async function getNextPendingComment(form: Comments): Promise<CommentRecord | null> {

    // Инвариант: итерируемся по снапшоту — очередь может меняться во время await
    const candidates = form.store.getAll();

    // .find возвращает undefined для пустой очереди — нормализуем к null
    return candidates.find((comment) => comment.is_sending && !comment.is_error_sending) ?? null;

}

/**
 * ***************************************************************************
 * Дождаться отмены текущего файла: промис отклоняется с кодом
 * `UPLOAD_ABORTED`, как только пользователь снял файл (обработчик onCancel).
 *
 * Нужен для гонки с `save attach`: запрос серверной обработки нельзя прервать,
 * а цикл по файлам не должен стоять из-за отмены до ответа сервера (до 120 с).
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

/**
 * Ошибки, при которых комментарий уже нельзя отправить (доступ/настройки/сущность):
 * запись убирается из очереди, пользователю показывается причина.
 */
const COMMENT_GONE_ERRORS = new Set([
    "COMMENTING_DISABLED_IN_CHANNEL",
    "COMMENTING_DISABLED_IN_POST",
    "SUBSCRIPTION_REQUIRED",
    "ENTITY_NOT_FOUND",
    "COMMENT_NOT_FOUND"
]);

/**
 * Валидационные ошибки `[comment]: send`: комментарий остаётся в очереди со
 * статусом ошибки (пользователь может отредактировать/повторить), но очередь
 * продолжаем: это не сетевая проблема.
 */
const VALIDATION_ERRORS = new Set([
    "TEXT_OR_ATTACHMENTS_REQUIRED",
    "TEXT_TOO_LONG",
    "INVALID_TEXT",
    "INVALID_ATTACHMENTS",
    "DOCUMENT_ID_INVALID",
    "DOCUMENT_ID_REQUIRED",
    "INVALID_REPLY_TO_COMMENT_ID",
    "REPLY_TO_COMMENT_NOT_FOUND",
    "REPLY_TO_COMMENT_MISMATCH"
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

/** Серверный код отказа → ключ локали (секция forms.comments.toasts). */
const UPLOAD_LOCALE: Record<string, string> = {
    INVALID_FILE_SIZE: "file_too_large",
    INVALID_EXTENSION: "invalid_extension",
    INVALID_MIME_TYPE: "invalid_mime",
    MIME_TYPE_REQUIRED: "invalid_mime",
    MIME_EXTENSION_MISMATCH: "invalid_mime"
};
