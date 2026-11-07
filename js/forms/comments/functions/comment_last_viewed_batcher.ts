// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

/**
 * ***************************************************************************
 * CommentLastViewedBatcher - батчер отправки отметки «прочитано до» ветки.
 *
 * Зачем нужен модуль (по образцу `forms/messages/functions/last_viewed_batcher.ts`):
 * - IntersectionObserver при быстром скролле срабатывает десятками раз подряд,
 *   и пользователь отправлял бы десятки одинаковых WS-запросов в секунду —
 *   вперемешку с `[comment]: send`, у которого лимит 30/60s. Скролл мог
 *   «съесть» лимит отправки комментариев и привести к RATE_LIMIT_EXCEEDED.
 * - На сервере важна только последняя (максимальная) отметка: позиция двигается
 *   только вперёд (`greatest`), промежуточные значения терялись бы без пользы.
 *
 * Решение: храним последний comment_id и отправляем его не чаще, чем раз в
 * `intervalMs`, а при закрытии формы — досылаем (flush).
 *
 * Отличие от сообщений: у комментариев нет локального счётчика непрочитанных
 * (бейдж живёт у поста, а не у ветки), поэтому `readCount` здесь не нужен —
 * батчер только двигает позицию чтения. Формы независимы — правь парный файл
 * в Messages.
 * ***************************************************************************
 */

/**
 * Id комментариев в батчере — всегда строки: приходят из DOM (`data-id`),
 * в Store и на сервер идут как UUID v7. Числовых id в этом пути нет.
 */
type CommentLastViewedId = string;

/** Функция отправки отметки: (commentId, сколько комментариев прочитано с прошлой отправки). */
export type CommentLastViewedFlushCallback = (commentId: CommentLastViewedId, readCount: number) => void | Promise<void>;

/**
 * ***************************************************************************
 * CommentLastViewedBatcher - накопитель отметок о прочтении ветки.
 * ***************************************************************************
 */
export class CommentLastViewedBatcher {

    /** Минимальный интервал между отправками в миллисекундах. */
    intervalMs: number;

    /** Функция отправки (задаётся вызывающим кодом, null после destroy). */
    flushCallback: CommentLastViewedFlushCallback | null;

    /** Контекст для логов. */
    context: string;

    /** Последний comment_id, который нужно отправить. */
    pendingCommentId: CommentLastViewedId | null;

    /** Сколько комментариев было прочитано с момента последней отправки. */
    readCount: number;

    /** Таймер отложенной отправки. */
    timerId: ReturnType<typeof setTimeout> | null;

    /** Флаг: отправка уже идёт (не запускаем вторую параллельно). */
    isFlushing: boolean;

    /** Отметки, пришедшие пока шла отправка — отправим их следом. */
    queuedWhileFlushing: CommentLastViewedId | null;

    /**
     * ***************************************************************************
     * Конструктор батчера отметок о прочтении ветки.
     * @param options - Параметры (интервал, функция отправки, контекст логов).
     * ***************************************************************************
     */
    constructor(options: {
        intervalMs?: number;
        flushCallback?: CommentLastViewedFlushCallback;
        context?: string;
    } = {}) {

        // Отправляем не чаще раза в интервал (защита от сетевого шторма)
        this.intervalMs = options.intervalMs ?? 700;

        // Что именно отправлять — задаётся вызывающим кодом (обычно это функция
        // updateLastViewedCommentRequest с формой). Опциональность нормализуем
        // к null: поле класса — «нет функции отправки», а не undefined
        this.flushCallback = options.flushCallback ?? null;

        // Контекст для логов
        this.context = options.context || "[app][comments][last-viewed]";

        // Последний comment_id, который нужно отправить
        this.pendingCommentId = null;

        // Сколько комментариев было прочитано с момента последней отправки
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
     * @param commentId - Id последнего прочитанного комментария.
     * @returns void
     * ***************************************************************************
     */
    schedule(commentId: CommentLastViewedId): void {

        // Без id или без функции отправки делать нечего
        if (commentId === null || commentId === undefined) return;
        if (typeof this.flushCallback !== "function") return;

        // Отметки приходят по возрастанию (uuid v7), поэтому всегда берём максимум.
        // Иначе при догрузке истории более старые комментарии «откатили» бы отметку.
        if (this.pendingCommentId === null || isNewer(commentId, this.pendingCommentId)) {
            this.pendingCommentId = commentId;
        }

        // Считаем прочитанные комментарии (для логов и будущих расчётов)
        this.readCount += 1;

        // Отправка уже идёт — запомним и отправим следом
        if (this.isFlushing) {
            this.queuedWhileFlushing = this.pendingCommentId;
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
     * Используется при закрытии формы, чтобы отметка не потерялась.
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
        if (this.pendingCommentId === null) return;

        // Отправка уже идёт — запоминаем значение и выходим
        if (this.isFlushing) {
            this.queuedWhileFlushing = this.pendingCommentId;
            return;
        }

        const commentId = this.pendingCommentId;
        this.pendingCommentId = null;

        // Забираем счётчик прочитанных и сразу обнуляем: если отправка упадёт,
        // значения всё равно не восстановить — на следующем такте счётчик
        // будет посчитан заново от серверного значения.
        const readCount = this.readCount;
        this.readCount = 0;
        this.isFlushing = true;

        try {
            // После destroy колбэк обнулён — отправлять нечего
            await this.flushCallback?.(commentId, readCount);
        } catch (error) {

            // Отметка о прочтении не критична: логируем и идём дальше.
            Logger.error(`${this.context}: не удалось отправить отметку о прочтении ${commentId}.`, error);

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
     * Сбросить состояние батчера (при закрытии формы).
     * @returns void
     * ***************************************************************************
     */
    destroy(): void {

        // Гасим таймер: отправка после закрытия формы уже не нужна
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        // Чистим состояние
        this.pendingCommentId = null;
        this.queuedWhileFlushing = null;
        this.readCount = 0;
        this.isFlushing = false;
        this.flushCallback = null;

    }

}

/**
 * ***************************************************************************
 * Сравнить два id комментариев: больше ли `candidate`, чем `current`.
 *
 * Id — UUID v7, в котором старшие биты содержат временную метку, поэтому
 * лексикографическое сравнение строк равносильно сравнению по времени
 * (и не теряет точность, как это делали бы числа выше 2^53).
 * @param candidate - Проверяемый id.
 * @param current - Текущий максимум.
 * @returns true, если candidate новее.
 * ***************************************************************************
 */
function isNewer(candidate: CommentLastViewedId, current: CommentLastViewedId): boolean {

    return candidate > current;

}
