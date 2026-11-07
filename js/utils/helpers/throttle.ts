/**
 * ***************************************************************************
 * Throttle (троттлинг) — ограничивает частоту вызовов функции.
 *
 * Где применяется в проекте:
 * - статус «печатает»: сервер всё равно показывает его не чаще раза в 4 секунды,
 *   поэтому слать чаще бессмысленно — только выжигаем лимит запросов;
 * - обновление последней отметки о прочтении;
 * - обработчики `scroll`/`resize`, где важна регулярность, а не «тишина».
 *
 * Отличие от debounce: throttle пропускает вызов сразу (leading), а потом
 * разрешает следующий не раньше, чем пройдёт `wait`. То есть во время потока
 * вызовов функция выполняется регулярно, а не один раз в конце.
 *
 * Важное свойство: у обёртки есть `.cancel()`, чтобы троттлинг не «выстрелил»
 * после закрытия формы.
 * ***************************************************************************
 */

/**
 * Опции throttle.
 */
export interface ThrottleOptions {

    /** Вызвать сразу на первом событии (по умолчанию true). */
    leading?: boolean;

    /** Дослать последний вызов после паузы (по умолчанию true). */
    trailing?: boolean;

}

/**
 * Ограниченная по частоте функция.
 */
export interface ThrottledFunction<T extends unknown[]> {

    /** Вызов обёртки. */
    (...args: T): void;

    /** Отменить отложенный вызов (форма закрыта / элемент удалён). */
    cancel(): void;

}

/**
 * ***************************************************************************
 * Создать throttle-обёртку.
 * @param fn - Функция, которую нужно ограничить.
 * @param wait - Минимальный интервал между вызовами в миллисекундах (по умолчанию 1000).
 * @param options - Опции (см. ThrottleOptions).
 * @returns Обёртка с cancel().
 * ***************************************************************************
 */
export function throttle<T extends unknown[]>(
    fn: (...args: T) => void,
    wait = 1000,
    options: ThrottleOptions = {}
): ThrottledFunction<T> {

    // Что делать — проверяем сразу, чтобы ошибка была на месте создания
    if (typeof fn !== "function") {
        throw new TypeError("Throttle: передан не функция.");
    }

    const leading = options.leading !== false;
    const trailing = options.trailing !== false;

    // Время последнего фактического вызова (0 — ещё ни разу не вызывали)
    let lastCallTime = 0;

    // Таймер отложенного («добивающего») вызова
    let timerId: ReturnType<typeof setTimeout> | null = null;

    // Аргументы последнего вызова, если он был отложен
    let lastArgs: T | null = null;
    let lastThis: unknown = null;

    /**
     * ***************************************************************************
     * Вызов обёртки.
     * ***************************************************************************
     */
    function throttled(this: unknown, ...args: T): void {

        const now = Date.now();

        // Первый вызов: ещё не было ни одного
        if (lastCallTime === 0) {

            lastCallTime = now;

            if (leading) {
                lastArgs = null;
                lastThis = null;
                fn.apply(this, args);
            } else if (trailing) {
                lastArgs = args;
                lastThis = this;
            }

            return;

        }

        // Прошло достаточно времени с прошлого вызова — выполняем сразу
        const remaining = wait - (now - lastCallTime);
        if (remaining <= 0) {

            lastCallTime = now;

            // Таймер «добивающего» вызова больше не нужен
            if (timerId !== null) {
                clearTimeout(timerId);
                timerId = null;
            }

            const argsToUse = lastArgs;
            const thisToUse = lastThis;

            lastArgs = null;
            lastThis = null;

            fn.apply(argsToUse ? thisToUse : this, argsToUse || args);

            return;

        }

        // Слишком рано: запоминаем аргументы и планируем «добивающий» вызов
        lastArgs = args;
        lastThis = this;

        if (trailing && timerId === null) {
            timerId = setTimeout(() => {

                timerId = null;
                lastCallTime = Date.now();

                const argsToUse = lastArgs;
                const thisToUse = lastThis;

                lastArgs = null;
                lastThis = null;

                if (argsToUse) fn.apply(thisToUse, argsToUse);

            }, remaining);
        }

    }

    /**
     * ***************************************************************************
     * Отменить отложенный вызов (форма закрыта / элемент удалён).
     * ***************************************************************************
     */
    throttled.cancel = function (): void {

        if (timerId !== null) clearTimeout(timerId);
        timerId = null;
        lastArgs = null;
        lastThis = null;
        lastCallTime = 0;

    };

    return throttled;

}
