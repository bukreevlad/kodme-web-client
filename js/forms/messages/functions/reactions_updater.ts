// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";
import { cleanStoreData } from "../../../utils/helpers/clean_store_data.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем requests
import { getMessageReactionsRequest } from "../requests/message_get_reactions.js";

// Импортируем типы
import type { MessageReaction } from "../components/types.js";
import type { MessageRecord } from "../types.js";
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * ReactionsUpdater - поллинг реакций для видимых сообщений.
 *
 * Почему поллинг, а не пуш: сервер не рассылает событие «реакции изменились»
 * участникам канала, поэтому клиенту приходится опрашивать. Раз в 4 секунды
 * по id видимых сообщений — компромисс между задержкой и нагрузкой.
 *
 * Почему состояние на форме, а не на модуле (обратно к старой реализации):
 * - на модуле был один глобальный набор видимых сообщений и один таймер,
 *   поэтому при двух открытых чатах поллинг переключался на «последний
 *   проскоривший» канал, а первый переставал обновлять реакции;
 * - при закрытии чата чужой таймер продолжал опрашивать уже закрытый канал.
 * Теперь у каждой формы своё состояние, а `stopReactionsPolling(form)`
 * останавливает именно его.
 *
 * Экземпляр создаётся лениво: чат без видимых сообщений не должен слать запросы.
 * ***************************************************************************
 */

/**
 * ***************************************************************************
 * ReactionsUpdater - менеджер поллинга реакций одного чата.
 * ***************************************************************************
 */
export class ReactionsUpdater {

    /** Форма, к которой относится менеджер. */
    form: Messages;

    /** Период опроса реакций в миллисекундах. */
    intervalMs: number;

    /** Максимум id за один запрос. */
    maxIdsPerRequest: number;

    /** Id сообщений, которые сейчас видны на экране. */
    visibleMessageIds: Set<string>;

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
     * @param form - Экземпляр формы сообщений.
     * @param options - Параметры (период опроса, лимит id за запрос).
     * ***************************************************************************
     */
    constructor(form: Messages, options: { intervalMs?: number; maxIdsPerRequest?: number } = {}) {

        // Форма, к которой относится менеджер
        this.form = form;

        // Период опроса и лимит id за запрос
        this.intervalMs = options.intervalMs ?? 4000;
        this.maxIdsPerRequest = options.maxIdsPerRequest ?? 100;

        // Id сообщений, которые сейчас видны на экране
        this.visibleMessageIds = new Set();

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
     * Добавить или убрать сообщение из списка видимых и управлять таймером.
     * @param messageId - ID сообщения.
     * @param isIntersecting - Видно сообщение или нет.
     * @returns void
     * ***************************************************************************
     */
    track(messageId: string, isIntersecting: boolean): void {

        // Менеджер уничтожен (форма закрыта) — игнорируем события обсервера
        if (this.isDestroyed || !messageId) return;

        // Добавляем или удаляем из набора видимых
        if (isIntersecting) {
            this.visibleMessageIds.add(messageId);
        } else {
            this.visibleMessageIds.delete(messageId);
        }

        // Появились видимые сообщения, а таймер не запущен — запускаем
        if (this.visibleMessageIds.size > 0 && this.timerId === null) {
            this.start();
        }

        // Ушли со всех сообщений — останавливаем, чтобы не жечь запросы
        else if (this.visibleMessageIds.size === 0 && this.timerId !== null) {
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
     * Остановить поллинг и освободить состояние (при закрытии чата).
     * @returns void
     * ***************************************************************************
     */
    destroy(): void {

        this.isDestroyed = true;
        this.stop();
        this.visibleMessageIds.clear();

    }

    /**
     * ***************************************************************************
     * Приватный метод: один цикл опроса.
     * @returns Promise<void>
     * ***************************************************************************
     */
    async _poll(): Promise<void> {

        // Форма закрыта или видно всё ещё ничего — запрос не нужен
        if (this.isDestroyed || this.visibleMessageIds.size === 0) return;

        // Предыдущий запрос ещё идёт — пропускаем такт
        if (this.isRequesting) return;

        // Нарезаем id на порции: сервер получает массив в один запрос,
        // а при 300 видимых сообщениях payload раздувался
        const allIds = Array.from(this.visibleMessageIds);
        const chunks = [];
        for (let index = 0; index < allIds.length; index += this.maxIdsPerRequest) {
            chunks.push(allIds.slice(index, index + this.maxIdsPerRequest));
        }

        this.isRequesting = true;

        try {

            for (const ids of chunks) {

                // Пока шли предыдущие порции, чат могли закрыть
                if (this.isDestroyed) return;

                const response = await getMessageReactionsRequest({
                    channel_id: this.form.channelId,
                    message_ids: ids
                });

                await applyReactions(this.form, response?.data || {});

            }

        } catch (error) {

            // Ошибка поллинга не критична: в следующий цикл повторим.
            // Раньше здесь был Logger.error на каждом такте при отсутствии сети.
            Logger.warn(`[app][messages][reactions]: опрос не удался (${this.form.channelId}).`, getErrorMessage(error));

        } finally {

            this.isRequesting = false;

        }

    }

}

/**
 * ***************************************************************************
 * Применить реакции к сообщениям в Store и в IndexedDB.
 * @param form - Экземпляр формы сообщений.
 * @param reactionsById - Реакции в формате { message_id: [...] }.
 * @returns Promise<void>
 * ***************************************************************************
 */
async function applyReactions(form: Messages, reactionsById: Record<string, unknown>): Promise<void> {

    // Форма закрылась, пока шёл запрос — данные уже некуда применить
    if (!form || !form.store) return;

    // Проходим по реакциям
    for (const [messageId, entry] of Object.entries(reactionsById)) {

        // Сообщение могло быть удалено/вытеснено из окна пока шёл запрос
        const message = form.store.get(messageId);
        if (!message) continue;

        // Системные сообщения реакций не имеют
        if (message.action_type) continue;

        // invariant: сервер группирует реакции по id сообщения — значение это
        // массив реакций (отсутствие/не-массив нормализуем в пустой список)
        const reactions = (Array.isArray(entry) ? entry : []) as MessageReaction[];

        // Перерисовываем реакции в DOM (метод навешивается в MessageItem)
        message.__updateReactions__?.(reactions);

        // Обновляем IndexedDB
        const entity = await IndexedDB.db?.table<MessageRecord, string>("messages").get(messageId);
        if (entity) {
            entity.reactions = reactions;
            // invariant: cleanStoreData возвращает копию записи сообщения без служебных ключей
            await IndexedDB.db?.table<MessageRecord, string>("messages").put(cleanStoreData(entity) as MessageRecord);
        }

    }

}

/**
 * ***************************************************************************
 * Остановить поллинг реакций указанной формы.
 *
 * Старая сигнатура принимала channelId и глобальные переменные модуля;
 * теперь поллинг принадлежит форме, поэтому и останавливаем её конкретный
 * менеджер (у каждой формы он свой).
 * @param form - Экземпляр формы сообщений.
 * @returns void
 * ***************************************************************************
 */
export function stopReactionsPolling(form: Messages): void {

    form?.reactionsUpdater?.destroy();
    form.reactionsUpdater = null;

}
