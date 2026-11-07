// Импортируем utils
import { DurationFormatter } from "../../../utils/date/duration_formatter.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { parseTimestampMs } from "./parse_timestamp.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";

/**
 * ***************************************************************************
 * Форматирует количество секунд в вид mm:ss, а после часа — hh:mm:ss.
 *
 * Форматирование отдано общей утилите проекта (utils/date/duration_formatter.ts),
 * а не написано здесь заново: разбор «часы/минуты/секунды» в проекте уже есть,
 * и вторая копия однажды разойдётся с первой. Дни утилиты складываются в часы
 * (`includeDays: false`) — конференция длится часами, а не сутками, поэтому
 * «12 ч 30 мин» читается вернее, чем «0 дн 12:30:00».
 *
 * Часы утилита тоже дополняет нулём, и это не декоративно: таймер тикает
 * раз в секунду, и без дополнения подпись прыгала бы по ширине на девятой
 * минуте каждого часа.
 * @param seconds - Количество секунд.
 * @returns Строка вида "05:03" или "01:05:03".
 * ***************************************************************************
 */
export function formatDuration(seconds: number): string {

    // Любое не-число (NaN, undefined, мусор из разметки) показываем как ноль:
    // таймер в шапке не имеет права печатать «NaN:NaN:NaN»
    const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;

    return new DurationFormatter(total * 1000).getFormattedDuration({
        includeSeconds: true,
        includeDays: false,
        trimEmptyUnits: true
    });

}

/**
 * Сколько секунд прошло с момента начала конференции.
 * @param startedAt - Отметка времени начала (мс).
 * @returns Количество секунд, не меньше нуля.
 */
function elapsedSeconds(startedAt: number): number {
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

/**
 * ***************************************************************************
 * Запускает таймер длительности конференции в шапке формы.
 *
 * Отсчёт идёт от `meets.created_at`, а не от подключения пользователя,
 * и это принципиально: у всех участников должно показывать одно и то же
 * число, иначе «длительность конференции» превращается в «сколько я
 * тут сижу» и перестаёт быть чем-то общим.
 *
 * Если `created_at` нет или он неправдоподобен (см. parse_timestamp.ts),
 * отсчёт идёт от подключения: это ошибка на минуту, а не на недели.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function startTimer(form: MeetPlay): void {

    try {

        // ---------- ПОВТОРНЫЙ ЗАПУСК ----------
        // Форма переоткрывается без пересоздания (реестр экземпляров),
        // поэтому таймер мог бы запуститься второй раз
        if (form.durationTimer) return;

        // ---------- ТОЧКА ОТСЧЁТА ----------
        const startedAt = parseTimestampMs(form.meet?.created_at) || Date.now();

        // ---------- ПЕРВЫЙ ТИК ----------
        // Рисуем значение сразу, иначе в шапке секунду пустует «00:00»
        const first = form.tpl?.querySelector(":scope [data-timer]");
        if (first) first.textContent = formatDuration(elapsedSeconds(startedAt));

        form.durationTimer = setInterval(() => {
            const timer = form.tpl?.querySelector(":scope [data-timer]");
            if (!timer) return;
            timer.textContent = formatDuration(elapsedSeconds(startedAt));
        }, 1000);

    } catch (error) {
        Logger.error("🚨 [meet-play]: Не удалось запустить таймер конференции:", error);
    }

}

/**
 * ***************************************************************************
 * Останавливает таймер длительности конференции.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function stopTimer(form: MeetPlay): void {

    if (!form?.durationTimer) return;
    clearInterval(form.durationTimer);
    form.durationTimer = null;

}
