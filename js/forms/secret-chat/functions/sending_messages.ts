// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { SecretChat } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/** Метаданные передаваемого файла (поля file_offer). */
export interface SecretSendFileMeta {

    /** Имя файла. */
    name: string;

    /** MIME-тип файла. */
    mime_type: string;

    /** Длительность медиа в миллисекундах. */
    duration: number | null;

    /** Ширина (медиа). */
    width: number | null;

    /** Высота (медиа). */
    height: number | null;

}

/** Один файл сообщения в очереди передачи. */
export interface SecretSendFile {

    /** Id файла (UUIDv7, тот же, что в payload сообщения). */
    fileId: string;

    /** Данные файла. */
    blob: Blob;

    /** Метаданные файла. */
    meta: SecretSendFileMeta;

}

/** Задача передачи: файлы одного сообщения. */
export interface SecretSendTask {

    /** Id сообщения-владельца. */
    messageId: string;

    /** Файлы сообщения. */
    files: SecretSendFile[];

}

/**
 * Очереди передачи по формам: пока одна форма крутит цикл, новые задачи
 * копятся здесь (как pending_messages в forms/messages).
 */
const pendingQueues = new WeakMap<SecretChat, SecretSendTask[]>();

/**
 * Формы, у которых цикл передачи уже выполняется (form-scoped: открытые
 * чаты не блокируют друг друга).
 */
const sendingForms = new WeakSet<SecretChat>();

/**
 * ***************************************************************************
 * queueFiles - поставить файлы сообщения в очередь передачи и запустить
 * цикл отправки (по образцу forms/messages/functions/sending_messages.ts).
 * @param form - Экземпляр формы.
 * @param task - Файлы сообщения.
 * @returns void
 * ***************************************************************************
 */
export function queueFiles(form: SecretChat, task: SecretSendTask): void {

    const queue = pendingQueues.get(form) ?? [];
    queue.push(task);
    pendingQueues.set(form, queue);

    // Цикл обработки очереди (сам защищён от параллельного запуска)
    sendingMessages(form);

}

/**
 * ***************************************************************************
 * sendingMessages - цикл передачи файлов очереди: ждём живого соединения
 * и отправляем файлы чанками с прогрессом (события file::progress ведут
 * прогресс-бары вложений, см. functions/file_progress.ts).
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function sendingMessages(form: SecretChat): Promise<void> {

    // Проверка флага: если цикл этой формы уже выполняется — не запускаем новый
    if (sendingForms.has(form)) return;
    sendingForms.add(form);

    try {

        const queue = pendingQueues.get(form) ?? [];

        // Основной цикл: выполняется, пока есть задачи в очереди
        while (queue.length > 0) {

            // invariant: очередь непустая — while выше это гарантирует
            const task = queue[0]!;

            for (const file of task.files) {

                // Форма закрыта во время отправки — останавливаем очередь
                if (SecretChat.instances.get(form.chatId) !== form) return;

                try {

                    // Передача требует живого соединения: ждём подключения
                    await waitForConnection(form);

                    // Сигнализируем собеседнику о загрузке файла
                    form.typingStatus.send({ action: "uploading_document" });

                    // Передаём файл чанками (file_offer → чанки → file_done)
                    const manager = SecretChatsManager.instance;
                    if (!manager) return;
                    await manager.transferFile(form.chatId, task.messageId, file.fileId, file.blob, file.meta);

                } catch (error) {

                    // Обрыв/ошибка передачи: файл помечен failed менеджером,
                    // очередь останавливаем — пользователю показываем причину
                    Logger.error(`[app][secret-chat][sending][${file.fileId}]:`, error);

                    // Форма могла закрыться — тостить уже некому
                    if (SecretChat.instances.get(form.chatId) !== form) return;

                    Toast.warning(t("forms.secret_chat.toasts.uploading_failed"), { position: "bottom-center" });
                    return;

                }

            }

            // Задача обработана — убираем из очереди
            queue.shift();

        }

    } catch (error) {
        Logger.error("[app][secret-chat][sending]: Критическая ошибка цикла передачи:", error);
    } finally {

        // Снимаем блокировку цикла (только своей формы)
        sendingForms.delete(form);

    }

}

/**
 * ***************************************************************************
 * waitForConnection - ожидание живого P2P-соединения чата (передача файлов
 * возможна только при совместном онлайне).
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся при установке соединения.
 * ***************************************************************************
 */
function waitForConnection(form: SecretChat): Promise<void> {

    // Менеджер обязан быть инициализирован (создаётся вместе с home)
    const manager = SecretChatsManager.instance;
    if (!manager) return Promise.reject(new Error("Менеджер секретных чатов не инициализирован"));

    // Соединение уже установлено
    if (manager.getConnectionState(form.chatId) === "connected") return Promise.resolve();

    return new Promise<void>((resolve, reject) => {

        // Периодическая проверка: форма могла закрыться, пока ждали
        let timer: ReturnType<typeof setInterval> | null = null;

        // Ждём смены состояния соединения этого чата
        const unsubscribe = manager.on("connection::state", ({ chatId, state }) => {
            if (chatId !== form.chatId) return;
            if (state === "connected") {
                if (timer) clearInterval(timer);
                unsubscribe();
                resolve();
            }
        });

        timer = setInterval(() => {
            if (SecretChat.instances.get(form.chatId) === form) return;
            if (timer) clearInterval(timer);
            unsubscribe();
            reject(new Error("Форма закрыта до установки соединения"));
        }, 2000);

    });

}
