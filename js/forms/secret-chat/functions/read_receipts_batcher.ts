// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";
import { secretMessagesTable } from "../../../utils/secret_chats/secret_chats_db.js";

// Импортируем типы
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * ReadReceiptsBatcher - батчер квитанций «прочитано» входящих сообщений.
 *
 * IntersectionObserver при быстром скролле срабатывает десятками раз подряд:
 * квитанции собираются в набор и уходят одним control-кадром не чаще раза в
 * `intervalMs`, при закрытии чата — досылаются (flush). После успешной
 * отправки локальные записи получают статус "read" (маркер непрочитанных
 * уходит, у собеседника галочки становятся двойными).
 * ***************************************************************************
 */
export class ReadReceiptsBatcher {

    /** Минимальный интервал между отправками в миллисекундах. */
    intervalMs: number;

    /** Экземпляр формы (null после destroy — квитанции больше не шлём). */
    form: SecretChat | null;

    /** Id непрочитанных входящих, ожидающих квитанции. */
    pendingIds: Set<string>;

    /** Таймер отложенной отправки. */
    timerId: ReturnType<typeof setTimeout> | null;

    /** Флаг: отправка уже идёт (не запускаем вторую параллельно). */
    isFlushing: boolean;

    /**
     * ***************************************************************************
     * @param form - Экземпляр формы.
     * @param options - Опции (интервал отправки).
     * ***************************************************************************
     */
    constructor(form: SecretChat, options: { intervalMs?: number } = {}) {

        // Проверяем форму
        if (!form) throw new Error("ReadReceiptsBatcher: Не передан экземпляр формы");

        // Устанавливаем параметры
        this.form = form;
        this.intervalMs = options.intervalMs ?? 700;
        this.pendingIds = new Set();
        this.timerId = null;
        this.isFlushing = false;

    }

    /**
     * ***************************************************************************
     * Запланировать квитанцию о прочтении.
     * @param messageId - Id прочитанного входящего сообщения.
     * @returns void
     * ***************************************************************************
     */
    schedule(messageId: string): void {

        // Формы нет (чат закрыт) — квитанции не копим
        if (!this.form) return;

        this.pendingIds.add(messageId);

        // Отправка уже идёт — следующая и так запланирована таймером ниже
        if (this.isFlushing || this.timerId !== null) return;

        this.timerId = setTimeout(() => {
            this.timerId = null;
            this.flush();
        }, this.intervalMs);

    }

    /**
     * ***************************************************************************
     * Немедленно отправить накопленные квитанции (используется при закрытии
     * чата, чтобы «прочитано» не потерялось).
     * @returns Promise<void>
     * ***************************************************************************
     */
    async flush(): Promise<void> {

        // Снимаем таймер: он больше не нужен
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        // Нечего отправлять
        if (this.pendingIds.size === 0) return;

        // Отправка уже идёт — выходим, набор не теряется (flush заберёт следом)
        if (this.isFlushing) return;

        const form = this.form;
        if (!form) return;

        // Забираем набор и сразу обнуляем: при ошибке статус останется
        // непрочитанным и квитанция уйдёт при следующей видимости
        const ids = Array.from(this.pendingIds);
        this.pendingIds.clear();
        this.isFlushing = true;

        try {

            // Менеджер обязан быть инициализирован (создаётся вместе с home)
            const manager = SecretChatsManager.instance;

            // Соединения нет — квитанции не уходят: помечаем локально всё
            // равно нельзя (собеседник не узнал о прочтении). Возвращаем ids
            // в набор — уйдут при следующем срабатывании/подключении
            if (!manager) {
                ids.forEach(id => this.pendingIds.add(id));
                return;
            }

            // Отправка без соединения бросает ошибку — это штатный случай
            // офлайна собеседника, возвращаем ids и ждём reconnect
            try {
                await manager.sendReceipt(form.chatId, ids, "read");
            } catch {
                ids.forEach(id => this.pendingIds.add(id));
                return;
            }

            // Квитанция ушла: помечаем локальные записи прочитанными
            // (запись в БД + Store; Store сам перерисует строку)
            for (const messageId of ids) {

                const record = await secretMessagesTable().get(messageId);
                if (record && record.status !== "read") {
                    await secretMessagesTable().put({ ...record, status: "read" });
                }

                const storeRecord = form.store.get(messageId);
                if (storeRecord && storeRecord.status !== "read") {
                    form.store.update(messageId, { ...storeRecord, status: "read" });
                }

            }

        } catch (error) {

            // Квитанция не критична: логируем и идём дальше
            Logger.error("[app][secret-chat][read-receipts]: не удалось отправить квитанции о прочтении.", error);

        } finally {
            this.isFlushing = false;
        }

    }

    /**
     * ***************************************************************************
     * Сбросить состояние батчера (при закрытии чата).
     * @returns void
     * ***************************************************************************
     */
    destroy(): void {

        // Гасим таймер: отправка после закрытия чата уже не нужна
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        // Чистим состояние
        this.pendingIds.clear();
        this.isFlushing = false;
        this.form = null;

    }

}
