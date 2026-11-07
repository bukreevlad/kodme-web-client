// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

/**
 * ***************************************************************************
 * LastViewedBatcher - батчер отправки отметки «прочитано до».
 *
 * Зачем нужен модуль:
 * - Отметка о прочтении отправлялась на каждое проскоревшее сообщение.
 *   IntersectionObserver при быстром скролле (или при догрузке истории) срабатывает
 *   десятками раз подряд, и пользователь отправлял 20–30 одинаковых
 *   WS-запросов в секунду — вперемешку с `[message]: send`, у которого есть
 *   лимит 30 запросов в минуту. То есть скролл мог «съесть» лимит отправки
 *   сообщений и привести к ошибке RATE_LIMIT_EXCEEDED.
 * - На сервере важна только последняя (максимальная) отметка, поэтому
 *   промежуточные значения терялись без пользы.
 *
 * Решение: храним последний message_id и отправляем его не чаще, чем раз в
 * `intervalMs`, а при закрытии чата — досылаем (flush).
 *
 * Экземпляр живёт на форме (`form.lastViewedBatcher`): у каждого чата своя
 * отметка, глобальное состояние смешивало бы каналы.
 * ***************************************************************************
 */

/**
 * Id сообщений в батчере — всегда строки: приходят из DOM (`data-id`),
 * в Store и на сервер идут как UUID v7. Числовых id в этом пути нет,
 * поэтому тип узкий, а не «string | number» на всякий случай.
 */
type LastViewedId = string;

/** Функция отправки отметки: (messageId, сколько сообщений прочитано с прошлой отправки). */
export type LastViewedFlushCallback = (messageId: LastViewedId, readCount: number) => void | Promise<void>;

/**
 * ***************************************************************************
 * LastViewedBatcher - накопитель отметок о прочтении.
 * ***************************************************************************
 */
export class LastViewedBatcher {

    /** Минимальный интервал между отправками в миллисекундах. */
    intervalMs: number;

    /** Функция отправки (задаётся вызывающим кодом, null после destroy). */
    flushCallback: LastViewedFlushCallback | null;

    /** Контекст для логов. */
    context: string;

    /** Последний message_id, который нужно отправить. */
    pendingMessageId: LastViewedId | null;

    /** Сколько сообщений было прочитано с момента последней отправки.
     * Именно на это число уменьшается счётчик непрочитанных: вычитать
     * «минус один» на каждое событие обсервера нельзя — при батче один
     * запрос закрывает сразу десяток прочитанных сообщений. */
    readCount: number;

    /** Таймер отложенной отправки. */
    timerId: ReturnType<typeof setTimeout> | null;

    /** Флаг: отправка уже идёт (не запускаем вторую параллельно). */
    isFlushing: boolean;

    /** Отметки, пришедшие пока шла отправка — отправим их следом. */
    queuedWhileFlushing: LastViewedId | null;

    /**
     * ***************************************************************************
     * Конструктор батчера отметок о прочтении.
     * @param options - Параметры (интервал, функция отправки, контекст логов).
     * ***************************************************************************
     */
    constructor(options: {
        intervalMs?: number;
        flushCallback?: LastViewedFlushCallback;
        context?: string;
    } = {}) {

        // Отправляем не чаще раза в интервал (защита от сетевого шторма)
        this.intervalMs = options.intervalMs ?? 700;

        // Что именно отправлять — задаётся вызывающим кодом (обычно это функция
        // UpdateLastViewedMessageIdRequest с формой). Опциональность нормализуем
        // к null: поле класса — «нет функции отправки», а не undefined
        this.flushCallback = options.flushCallback ?? null;

        // Контекст для логов
        this.context = options.context || "[app][last-viewed]";

        // Последний message_id, который нужно отправить
        this.pendingMessageId = null;

        // Сколько сообщений было прочитано с момента последней отправки
        this.readCount = 0;

        // Таймер отложенной отправки
        this.timerId = null;

        // Флаг: отправка уже идёт (не запускаем вторую параллельно)
        this.isFlushing = false;

        // Отметки, пришедшие пока шла отправка — отправим их следом
        this.queuedWhileFlushing = null;

    }

    /**
     * ***************************************************************************
     * Запланировать отметку о прочтении.
     * @param messageId - Id последнего прочитанного сообщения.
     * @returns void
     * ***************************************************************************
     */
    schedule(messageId: LastViewedId): void {

        // Без id или без функции отправки делать нечего
        if (messageId === null || messageId === undefined) return;
        if (typeof this.flushCallback !== "function") return;

        // Отметки приходят по возрастанию (uuid v7), поэтому всегда берём максимум.
        // Иначе при догрузке истории более старые сообщения «откатили» бы отметку.
        if (this.pendingMessageId === null || isNewer(messageId, this.pendingMessageId)) {
            this.pendingMessageId = messageId;
        }

        // Считаем прочитанные сообщения: по ним батчер пересчитает непрочитанные
        this.readCount += 1;

        // Отправка уже идёт — запомним и отправим следом
        if (this.isFlushing) {
            this.queuedWhileFlushing = this.pendingMessageId;
            return;
        }

        // Таймер уже стоит — следующая отправка и так запланирована
        if (this.timerId !== null) return;

        this.timerId = setTimeout(() => {
            this.timerId = null;
            this.flush();
        }, this.intervalMs);

    }

    /**
     * ***************************************************************************
     * Немедленно отправить накопленную отметку.
     * Используется при закрытии чата, чтобы отметка не потерялась.
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
        if (this.pendingMessageId === null) return;

        // Отправка уже идёт — запоминаем значение и выходим
        if (this.isFlushing) {
            this.queuedWhileFlushing = this.pendingMessageId;
            return;
        }

        const messageId = this.pendingMessageId;
        this.pendingMessageId = null;

        // Забираем счётчик прочитанных и сразу обнуляем: если отправка упадёт,
        // значения всё равно не восстановить — на следующем такте счётчик
        // будет посчитан заново от серверного значения.
        const readCount = this.readCount;
        this.readCount = 0;
        this.isFlushing = true;

        try {
            // После destroy колбэк обнулён — отправлять нечего
            await this.flushCallback?.(messageId, readCount);
        } catch (error) {

            // Отметка о прочтении не критична: логируем и идём дальше.
            // Раньше здесь был Logger.error в Intersection без объяснения,
            // и потери отметки никто не замечал.
            Logger.error(`${this.context}: не удалось отправить отметку о прочтении ${messageId}.`, error);

        } finally {

            this.isFlushing = false;

            // Пока шла отправка, пришли новые отметки — отправляем их следом
            if (this.queuedWhileFlushing !== null) {
                const queued = this.queuedWhileFlushing;
                this.queuedWhileFlushing = null;
                this.schedule(queued);
            }

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
        this.pendingMessageId = null;
        this.queuedWhileFlushing = null;
        this.readCount = 0;
        this.isFlushing = false;
        this.flushCallback = null;

    }

}

/**
 * ***************************************************************************
 * Сравнить два id сообщений: больше ли `candidate`, чем `current`.
 *
 * Id — UUID v7, в котором старшие биты содержат временную метку, поэтому
 * лексикографическое сравнение строк равносильно сравнению по времени
 * (и не теряет точность, как это делали бы числа выше 2^53).
 * @param candidate - Проверяемый id.
 * @param current - Текущий максимум.
 * @returns true, если candidate новее.
 * ***************************************************************************
 */
function isNewer(candidate: LastViewedId, current: LastViewedId): boolean {

    return candidate > current;

}
