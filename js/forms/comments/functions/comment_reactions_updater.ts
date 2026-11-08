// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем requests
import { commentGetReactionsRequest } from "../requests/comment_get_reactions.js";

// Импортируем типы
import type { CommentReaction } from "../types.js";
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * CommentReactionsUpdater - поллинг реакций для видимых комментариев.
 *
 * Почему поллинг, а не пуш: сервер не рассылает событие «реакции изменились»
 * участникам канала (как и у сообщений), поэтому клиент опрашивает. Раз в 4
 * секунды по id видимых комментариев — компромисс между задержкой и нагрузкой.
 *
 * Скопирован из `forms/messages/functions/reactions_updater.ts` с адаптацией
 * под комментарии: у комментариев нет IndexedDB (всё живёт в памяти формы),
 * поэтому реакции применяются только в Store и в DOM строки. Формы независимы
 * — правь парный файл в Messages.
 *
 * Состояние — на форме, а не на модуле: при двух открытых ветках общий таймер
 * переключался бы на последний проскоривший комментарий. Экземпляр создаётся
 * лениво: ветка без видимых комментариев не должна слать запросы.
 * ***************************************************************************
 */

/**
 * ***************************************************************************
 * CommentReactionsUpdater - менеджер поллинга реакций одной ветки.
 * ***************************************************************************
 */
export class CommentReactionsUpdater {

    /** Форма, к которой относится менеджер. */
    form: Comments;

    /** Период опроса реакций в миллисекундах. */
    intervalMs: number;

    /** Максимум id за один запрос. */
    maxIdsPerRequest: number;

    /** Id комментариев, которые сейчас видны на экране. */
    visibleCommentIds: Set<string>;

    /** Идентификатор таймера. */
    timerId: ReturnType<typeof setInterval> | null;

    /** Флаг: идёт ли сейчас запрос. Не даёт запустить второй поверх первого —
     * при медленной сети интервал в 4с короче, чем ответ сервера. */
    isRequesting: boolean;

    /** Флаг: форма уже закрыта (запрос мог вернуться после закрытия). */
    isDestroyed: boolean;

    /**
     * ***************************************************************************
     * Конструктор менеджера поллинга реакций.
     * @param form - Экземпляр формы комментариев.
     * @param options - Параметры (период опроса, лимит id за запрос).
     * ***************************************************************************
     */
    constructor(form: Comments, options: { intervalMs?: number; maxIdsPerRequest?: number } = {}) {

        // Форма, к которой относится менеджер
        this.form = form;

        // Период опроса и лимит id за запрос
        this.intervalMs = options.intervalMs ?? 4000;
        this.maxIdsPerRequest = options.maxIdsPerRequest ?? 100;

        // Id комментариев, которые сейчас видны на экране
        this.visibleCommentIds = new Set();

        // Идентификатор таймера
        this.timerId = null;

        // Флаг: идёт ли сейчас запрос. Не даёт запустить второй поверх первого —
        // при медленной сети интервал в 4с короче, чем ответ сервера
        this.isRequesting = false;

        // Флаг: форма уже закрыта (запрос мог вернуться после закрытия)
        this.isDestroyed = false;

    }

    /**
     * ***************************************************************************
     * Добавить или убрать комментарий из списка видимых и управлять таймером.
     * @param commentId - ID комментария.
     * @param isIntersecting - Видно комментарий или нет.
     * @returns void
     * ***************************************************************************
     */
    track(commentId: string, isIntersecting: boolean): void {

        // Менеджер уничтожен (форма закрыта) — игнорируем события обсервера
        if (this.isDestroyed || !commentId) return;

        // Исходящие комментарии (ещё без серверного id) не опрашиваем
        if (this.form.pendingIds?.has(commentId)) return;

        // Добавляем или удаляем из набора видимых
        if (isIntersecting) {
            this.visibleCommentIds.add(commentId);
        } else {
            this.visibleCommentIds.delete(commentId);
        }

        // Появились видимые комментарии, а таймер не запущен — запускаем
        if (this.visibleCommentIds.size > 0 && this.timerId === null) {
            this.start();
        }

        // Ушли со всех комментариев — останавливаем, чтобы не жечь запросы
        else if (this.visibleCommentIds.size === 0 && this.timerId !== null) {
            this.stop();
        }

    }

    /**
     * ***************************************************************************
     * Запустить периодический опрос.
     * @returns void
     * ***************************************************************************
     */
    start(): void {

        // Уже запущен — второй таймер не нужен
        if (this.timerId !== null) return;

        this.timerId = setInterval(() => this._poll(), this.intervalMs);

    }

    /**
     * ***************************************************************************
     * Остановить периодический опрос.
     * @returns void
     * ***************************************************************************
     */
    stop(): void {

        if (this.timerId === null) return;

        clearInterval(this.timerId);
        this.timerId = null;

    }

    /**
     * ***************************************************************************
     * Остановить поллинг и освободить состояние (при закрытии формы).
     * @returns void
     * ***************************************************************************
     */
    destroy(): void {

        this.isDestroyed = true;
        this.stop();
        this.visibleCommentIds.clear();

    }

    /**
     * ***************************************************************************
     * Приватный метод: один цикл опроса.
     * @returns Promise<void>
     * ***************************************************************************
     */
    async _poll(): Promise<void> {

        // Форма закрыта или видно всё ещё ничего — запрос не нужен
        if (this.isDestroyed || this.visibleCommentIds.size === 0) return;

        // Предыдущий запрос ещё идёт — пропускаем такт
        if (this.isRequesting) return;

        // Нарезаем id на порции: сервер получает массив в один запрос,
        // а при большом числе видимых комментариев payload раздувался
        const allIds = Array.from(this.visibleCommentIds);
        const chunks = [];
        for (let index = 0; index < allIds.length; index += this.maxIdsPerRequest) {
            chunks.push(allIds.slice(index, index + this.maxIdsPerRequest));
        }

        this.isRequesting = true;

        try {

            for (const ids of chunks) {

                // Пока шли предыдущие порции, форму могли закрыть
                if (this.isDestroyed) return;

                const response = await commentGetReactionsRequest({
                    comment_ids: ids
                });

                applyReactions(this.form, response?.data || {});

            }

        } catch (error) {

            // Ошибка поллинга не критична: в следующий цикл повторим.
            Logger.warn(`[app][comments][reactions]: опрос не удался (${this.form.postId}).`, getErrorMessage(error));

        } finally {

            this.isRequesting = false;

        }

    }

}

/**
 * ***************************************************************************
 * Применить реакции к комментариям в Store и в DOM строк ленты.
 * @param form - Экземпляр формы комментариев.
 * @param reactionsById - Реакции в формате { comment_id: [...] }.
 * @returns void
 * ***************************************************************************
 */
function applyReactions(form: Comments, reactionsById: Record<string, unknown>): void {

    // Форма закрылась, пока шёл запрос — данные уже некуда применить
    if (!form || !form.store) return;

    // Проходим по реакциям
    for (const [commentId, entry] of Object.entries(reactionsById)) {

        // Комментарий мог быть удалён/вытеснен из окна пока шёл запрос
        const comment = form.store.get(commentId);
        if (!comment) continue;

        // invariant: сервер группирует реакции по id комментария — значение это
        // массив реакций (отсутствие/не-массив нормализуем в пустой список)
        const reactions = (Array.isArray(entry) ? entry : []) as CommentReaction[];

        // Обновляем запись Store: item::updated перерисует подписанную строку
        // (точечный ререндер вручную не нужен)
        form.store.update(commentId, { reactions });

    }

}

/**
 * ***************************************************************************
 * Остановить поллинг реакций указанной формы.
 * @param form - Экземпляр формы комментариев.
 * @returns void
 * ***************************************************************************
 */
export function stopCommentReactionsPolling(form: Comments): void {

    form?.commentReactionsUpdater?.destroy();
    if (form) form.commentReactionsUpdater = null;

}
