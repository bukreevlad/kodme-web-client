/**
 * SimpleRequestQueue (RequestQueue)
 * Очередь запросов, оптимизированная для быстрой обработки ТОЛЬКО последнего поступившего запроса.
 * Все старые запросы в очереди отменяются (отклоняются) при добавлении нового.
 */

/**
 * Параметры очереди запросов.
 */
export interface QueueOptions {

    /** Максимальное количество одновременно выполняемых запросов. Для логики «только последний» лучше 1. */
    concurrency?: number;

    /** Количество попыток повторного выполнения задачи в случае ошибки. */
    retryAttempts?: number;

    /** Базовая задержка перед повторной попыткой (умножается на retryCount). */
    retryDelay?: number;

    /** Задержка после добавления задачи перед началом обработки. */
    debounceDelay?: number;

    /** Минимальная задержка (в мс) между завершением одного запроса и началом следующего. */
    minDelay?: number;

}

/**
 * Параметры очереди со значениями по умолчанию (то, что реально применяется).
 */
interface ResolvedQueueOptions {

    concurrency: number;
    retryAttempts: number;
    retryDelay: number;
    debounceDelay: number;
    minDelay: number;

}

/**
 * Задача внутри очереди.
 */
interface QueueTask {

    /** Порядковый номер задачи. */
    id: number;

    /**
     * Выполнение задачи: запускает запрос и разрешает внешний промис add().
     *
     * Вместо хранения голого `resolve` промиса в задаче лежит замыкание,
     * созданное внутри `add()`: там тип результата известен (T), поэтому
     * разрешение промиса типизируется честно и без приведений.
     */
    execute: () => Promise<void>;

    /** Отклонение внешнего промиса add(). */
    reject: (reason?: unknown) => void;

    /** Сколько раз задача уже повторялась. */
    retryCount: number;

}

export class RequestQueue {

    /** Параметры очереди (с дефолтами). */
    readonly options: ResolvedQueueOptions;

    /** Очередь ожидающих выполнения задач. */
    queue: QueueTask[];

    /** Количество активных запросов. */
    activeRequests = 0;

    /** Таймер дебаунса обработки очереди. */
    debounceTimer: ReturnType<typeof setTimeout> | null = null;

    /** Последний выданный идентификатор задачи. */
    taskId = 0;

    constructor(options: QueueOptions = {}) {
        this.options = {
            concurrency: 1, // Оставляем 1, чтобы избежать гонок при очистке очереди
            retryAttempts: 3,
            retryDelay: 1000,
            debounceDelay: 300,
            minDelay: 100, // Добавлено, чтобы контролировать паузу между запросами
            ...options
        };

        this.queue = [];
    }

    /**
     * Добавить запрос в очередь (с дебаунсом).
     * @param requestCallback - Функция с логикой запроса (должна возвращать Promise).
     * @param params - Параметры для запроса (опционально; null — вызвать без аргументов).
     * @returns Промис с результатом выполнения.
     */
    add<T>(requestCallback: (params?: unknown) => Promise<T>, params: unknown = null): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const taskId = ++this.taskId;

            // Замыкание выполнения: запускает запрос с теми же аргументами
            // (без аргументов, если params не задан) и разрешает внешний
            // промис результатом того же типа T
            const execute = async (): Promise<void> => {
                const result = params !== null
                    ? await requestCallback(params)
                    : await requestCallback();
                resolve(result);
            };

            // Добавляем задачу в очередь
            this.queue.push({
                id: taskId,
                execute,
                reject,
                retryCount: 0
            });

            // 1. Дебаунс: очищает предыдущий таймер
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            // 2. Устанавливает новый таймер: обработка начнется после паузы
            this.debounceTimer = setTimeout(() => {
                this.debounceTimer = null;
                this.processQueue();
            }, this.options.debounceDelay);
        });
    }

    /**
     * Добавить задачу без дебаунса (немедленная обработка).
     * @param requestCallback - Функция с логикой запроса (должна возвращать Promise).
     * @param params - Параметры для запроса (опционально; null — вызвать без аргументов).
     * @returns Промис с результатом выполнения.
     */
    addImmediate<T>(requestCallback: (params?: unknown) => Promise<T>, params: unknown = null): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const taskId = ++this.taskId;

            // Замыкание выполнения — как в add(), но без отложенного запуска
            const execute = async (): Promise<void> => {
                const result = params !== null
                    ? await requestCallback(params)
                    : await requestCallback();
                resolve(result);
            };

            this.queue.push({
                id: taskId,
                execute,
                reject,
                retryCount: 0
            });

            // Немедленный запуск
            this.processQueue();
        });
    }

    /**
     * Обработка очереди: берет последнюю, удаляет и отменяет все остальные.
     */
    async processQueue(): Promise<void> {
        // Если уже обрабатывается или очередь пуста
        if (this.activeRequests >= this.options.concurrency || this.queue.length === 0) {
            return;
        }

        this.activeRequests++;

        // 1. Берем последнюю задачу (очередь проверена выше — она не пуста)
        const taskToRun = this.queue.pop();
        if (!taskToRun) {
            this.activeRequests--;
            return;
        }

        // 2. Все, что осталось в очереди, считаем устаревшим.
        const tasksToReject = this.queue;

        // 3. Очищаем очередь от устаревших задач
        this.queue = [];

        // 4. Отклоняем промисы для всех устаревших задач
        tasksToReject.forEach(task => {
            // Принудительно отклоняем промис чтобы не было "висящих" ожиданий;
            // code — уникальный код ошибки очереди
            const error = Object.assign(
                new Error(`Request ${task.id} superseded by a newer request (${taskToRun.id}).`),
                { code: "QUEUE_SUPERSEDED" }
            );
            task.reject(error);
        });

        // --- ВЫПОЛНЕНИЕ ---
        try {
            // Выполняем задачу: замыкание запускает запрос и разрешает
            // внешний промис add() результатом; ошибка пробрасывается наружу
            await taskToRun.execute();
        } catch (error) {
            // Повторные попытки
            if (taskToRun.retryCount < this.options.retryAttempts) {
                taskToRun.retryCount++;
                console.warn(`Повторная попытка ${taskToRun.retryCount} для задачи ${taskToRun.id}`);

                // Ждем перед повторной попыткой, используя экспоненциальную задержку
                await new Promise(resolve =>
                    setTimeout(resolve, this.options.retryDelay * taskToRun.retryCount)
                );

                // Возвращаем задачу в очередь для повторной попытки
                // Примечание: Она снова станет последней, пока не поступят новые.
                this.queue.push(taskToRun);
            } else {
                console.error(`Задача ${taskToRun.id} не удалась после ${this.options.retryAttempts} попыток:`, error);
                taskToRun.reject(error);
            }
        } finally {
            this.activeRequests--;

            // 5. Минимальная задержка между запросами (если задана)
            if (this.options.minDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, this.options.minDelay));
            }

            // 6. Обрабатываем следующую задачу, если есть (например, если в процессе выполнения
            // текущего запроса были добавлены новые, или текущая задача была возвращена
            // для повторной попытки)
            if (this.queue.length > 0) {
                // Используем setTimeout(..., 0) для предотвращения глубокой рекурсии
                setTimeout(() => this.processQueue(), 0);
            }
        }
    }

    /**
     * Очистить очередь.
     * Отменяет все ожидающие промисы.
     */
    clear(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // Отклоняем все ожидающие промисы
        this.queue.forEach(task => {
            task.reject(new Error("Queue cleared by user."));
        });

        this.queue = [];
    }

    /**
     * Получить статистику.
     */
    getStats(): { pending: number; active: number; totalQueued: number } {
        return {
            pending: this.queue.length,
            active: this.activeRequests,
            totalQueued: this.taskId
        };
    }

    /**
     * Ожидание завершения всех задач (очередь пуста и нет активных запросов).
     */
    async waitForAll(): Promise<void> {
        while (this.queue.length > 0 || this.activeRequests > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}
