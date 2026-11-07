// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { ProgressIndicator } from "../../../components/progress.js";

// Импортируем functions
import { loadSecretFile } from "./decrypt_message.js";

// Импортируем типы
import type { AttachmentsRaw } from "../../../utils/messages/attachments.js";
import type { SecretChat } from "../index.js";

/** Объект-мап вложений сообщения (тот же тип, что хранит запись Store). */
type SecretAttachmentsMap = Extract<AttachmentsRaw, Record<string, unknown>>;

/**
 * Найти вложение сообщения окна по file_id (объект-мап вложений
 * собирается build_attaches с ключом file_id).
 * @param form - Экземпляр формы.
 * @param fileId - Id файла.
 * @returns Найденное вложение с записью либо null.
 */
function findAttach(form: SecretChat, fileId: string): { attach: SecretAttachmentsMap[string]; messageId: string } | null {

    for (const record of form.store.getAll()) {

        // invariant: вложения секретных чатов собираются объект-мапом (build_attaches)
        const map = record.attachments;
        if (!map || Array.isArray(map)) continue;

        const attach = map[fileId];
        if (attach) return { attach, messageId: record.id };

    }

    return null;

}

/**
 * ***************************************************************************
 * updateFileProgress - прогресс передачи файла на вложении строки:
 * ProgressIndicator в [data-progress-wrap] всех DOM-копий вложения
 * (механика как в forms/messages/functions/sending_messages.ts).
 * @param form - Экземпляр формы.
 * @param fileId - Id файла.
 * @param loaded - Передано байт.
 * @param total - Всего байт.
 * @returns void
 * ***************************************************************************
 */
export function updateFileProgress(form: SecretChat, fileId: string, loaded: number, total: number): void {

    try {

        const found = findAttach(form, fileId);
        if (!found) return;

        const attach = found.attach;

        // Первое событие — создаём прогресс-бары на копиях вложения
        if (!attach.__progressInstances__?.length) {

            const created: ProgressIndicator[] = [];
            for (const element of attach.__domElements__ ?? []) {

                // Элемент мог уйти из DOM (обрезка окна) — пропускаем
                if (!element?.isConnected) continue;

                const progressWrap = element.querySelector("[data-progress-wrap]");
                if (!progressWrap) continue;

                const progress = new ProgressIndicator({ width: "100%" });
                progressWrap.appendChild(progress.getElement());
                progress.setProcessing();
                created.push(progress);

            }
            attach.__progressInstances__ = created;

        }

        // Шкала прогресса
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
        attach.__progressInstances__?.forEach((progress) => progress.update(percent));

    } catch (error) {
        Logger.error("[app][secret-chat][file-progress]:", error);
    }

}

/**
 * ***************************************************************************
 * clearFileProgress - убрать прогресс-бары вложения (передача завершена
 * или прервана).
 * @param form - Экземпляр формы.
 * @param fileId - Id файла.
 * @returns void
 * ***************************************************************************
 */
export function clearFileProgress(form: SecretChat, fileId: string): void {

    try {

        const found = findAttach(form, fileId);
        if (!found) return;

        found.attach.__progressInstances__?.forEach((progress) => progress.destroy());
        found.attach.__progressInstances__ = [];

    } catch (error) {
        Logger.error("[app][secret-chat][file-progress]:", error);
    }

}

/**
 * ***************************************************************************
 * applyFileBlob - подставить расшифрованный оригинал файла во вложение строки
 * (строка перерисовывается: фабрики вложений возьмут _file вместо миниатюры).
 * @param form - Экземпляр формы.
 * @param messageId - Id сообщения.
 * @param fileId - Id файла.
 * @param blob - Расшифрованный файл.
 * @returns void
 * ***************************************************************************
 */
export function applyFileBlob(form: SecretChat, messageId: string, fileId: string, blob: Blob): void {

    try {

        const record = form.store.get(messageId);
        if (!record?.attachments) return;

        // invariant: вложения секретных чатов собираются объект-мапом (build_attaches)
        const map = record.attachments;
        if (Array.isArray(map)) return;

        const attach = map[fileId];
        if (!attach) return;

        // Подменяем оригинал прямо в элементе вложения и перерисовываем строку
        attach._file = blob;
        form.store.update(messageId, { ...record, attachments: map });

    } catch (error) {
        Logger.error("[app][secret-chat][file-progress]:", error);
    }

}

/**
 * ***************************************************************************
 * preserveFileBlobs - перенос расшифрованных оригиналов файлов из прежних
 * вложений сообщения в новые.
 *
 * Запись сообщения пересобирается из payload при каждом событии
 * (статус доставки, правка) — синтезированные вложения содержат только
 * метаданные и миниатюры, и без переноса `_file` просмотрщик переставал
 * открывать уже принятые/отправленные файлы.
 * @param next - Новые вложения (из payload).
 * @param prev - Прежние вложения сообщения (из Store).
 * @returns Вложения с сохранёнными оригиналами.
 * ***************************************************************************
 */
export function preserveFileBlobs(next: AttachmentsRaw, prev: AttachmentsRaw | undefined): AttachmentsRaw {

    if (!prev || !next || Array.isArray(next) || Array.isArray(prev)) return next;

    for (const [fileId, attach] of Object.entries(next)) {
        const prevAttach = prev[fileId];
        if (prevAttach?._file instanceof Blob && !(attach._file instanceof Blob)) {
            attach._file = prevAttach._file;
        }
    }

    return next;

}

/**
 * Локальные оригиналы файлов по file_id: отправитель регистрирует их при
 * постановке в очередь — до завершения передачи записи в хранилище ещё нет,
 * а открывать свои файлы можно уже сейчас.
 */
const localOriginals = new Map<string, Blob>();

/**
 * ***************************************************************************
 * registerLocalOriginals - регистрация локальных оригиналов файлов сообщения
 * (их подставляют hydrate-функции вместо чтения из локального хранилища).
 * @param files - Файлы сообщения (id и данные).
 * @returns void
 * ***************************************************************************
 */
export function registerLocalOriginals(files: readonly { fileId: string; blob: Blob }[]): void {

    for (const file of files) {
        localOriginals.set(file.fileId, file.blob);
    }

}

/**
 * ***************************************************************************
 * hydrateMessageFiles - подстановка расшифрованных оригиналов файлов одного
 * сообщения (страховка от гонки «файл готов раньше строки сообщения»:
 * событие file::done могло не найти запись в Store).
 * @param form - Экземпляр формы.
 * @param messageId - Id сообщения.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function hydrateMessageFiles(form: SecretChat, messageId: string): Promise<void> {

    try {

        const record = form.store.get(messageId);
        if (!record?.attachments) return;

        // invariant: вложения секретных чатов собираются объект-мапом (build_attaches)
        const map = record.attachments;
        if (Array.isArray(map)) return;

        for (const fileId of Object.keys(map)) {

            const attach = map[fileId];
            if (!attach || attach._file instanceof Blob) continue;

            // Локальный оригинал отправителя — файл может ещё не быть в хранилище
            const local = localOriginals.get(fileId);
            if (local) {
                applyFileBlob(form, messageId, fileId, local);
                continue;
            }

            const loaded = await loadSecretFile(fileId);

            // Файл ещё не принят (передача идёт) — догружать нечего
            if (!loaded || loaded.record.status !== "complete") continue;

            // Запись могла уйти из окна, пока расшифровывали
            if (!form.store.get(messageId)) return;

            applyFileBlob(form, messageId, fileId, loaded.blob);

        }

    } catch (error) {
        Logger.error("[app][secret-chat][file-progress]: ошибка догрузки файлов:", error);
    }

}

/**
 * ***************************************************************************
 * hydrateFileBlobs - фоновая догрузка оригиналов файлов окна чата.
 *
 * Рендер строки строится по миниатюрам payload (быстро и без расшифровки);
 * оригиналы нужны для просмотра/воспроизведения и подставляются в записи
 * асинхронно, после отрисовки. Уже готовые записи пропускаются.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающееся после обхода окна.
 * ***************************************************************************
 */
export async function hydrateFileBlobs(form: SecretChat): Promise<void> {

    try {

        for (const record of form.store.getAll()) {

            if (!record.attachments) continue;

            // invariant: вложения секретных чатов собираются объект-мапом (build_attaches)
            const map = record.attachments;
            if (Array.isArray(map)) continue;

            for (const [fileId, attach] of Object.entries(map)) {

                // Оригинал уже подставлен
                if (attach._file instanceof Blob) continue;

                // Локальный оригинал отправителя — файл может ещё не быть в хранилище
                const local = localOriginals.get(fileId);
                if (local) {
                    applyFileBlob(form, record.id, fileId, local);
                    continue;
                }

                // Файл расшифровываем по одному, чтобы не блокировать UI
                const loaded = await loadSecretFile(fileId);

                // Файл ещё не принят (передача идёт) — догружать нечего
                if (!loaded || loaded.record.status !== "complete") continue;

                // Запись могла уйти из окна, пока расшифровывали
                if (!form.store.get(record.id)) continue;

                applyFileBlob(form, record.id, fileId, loaded.blob);

            }

        }

    } catch (error) {
        Logger.error("[app][secret-chat][file-progress]: ошибка догрузки файлов:", error);
    }

}
