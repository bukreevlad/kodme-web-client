/**
 * Режимы отображения времени:
 *  - short          → относительное время ("5 минут назад");
 *  - long           → абсолютное ("Сегодня в 09:40" / "В 09:40, 14 февраля 2026 г.");
 *  - date           → только дата ("14 февраля 2026 г.");
 *  - datetime       → всегда дата + время ("В 09:40, 14 февраля 2026 г.");
 *  - compact        → короткий формат ("14.02" или "14.02.2026");
 *  - telegram       → полный Telegram с датой и временем ("09:40" / "14.02 в 09:40");
 *  - telegram-time  → только время в стиле Telegram ("09:40");
 *  - telegram-list  → формат списка чатов Telegram ("09:40" / "вчера" / "14.02").
 */
import { t } from "../i18n/index.js";

export type DisplayType =
    | "short"
    | "long"
    | "date"
    | "datetime"
    | "compact"
    | "telegram"
    | "telegram-time"
    | "telegram-list";

/**
 * ***************************************************************************
 * TimeAgoFormatter
 * Класс для форматирования времени.
 *
 * ВАЖНО (инвариант): все методы форматирования вызываются только из геттера
 * `formattedTime` после проверки `isValid`, поэтому `this.date` к моменту
 * вызова всегда разобран и не null.
 *
 * @param date - Дата (Date, ISO-строка или timestamp); null/пусто — формат пустой.
 * @param displayType - Режим отображения (по умолчанию "telegram").
 * @param locale - Локаль (по умолчанию из локализации, иначе "ru-RU").
 * ***************************************************************************
 */
export class TimeAgoFormatter {

    /** Локаль форматирования. */
    readonly locale: string;

    /** Режим отображения. */
    readonly displayType: DisplayType;

    /** Текущий момент (создаётся при инстанцировании). */
    readonly now: Date;

    /** Флаг валидности даты: false — форматирование вернёт пустую строку. */
    isValid: boolean;

    /** Разобранная дата (null, если входные данные невалидны). */
    date: Date | null;

    /**
     * ***************************************************************************
     * Дата форматирования с проверкой инварианта.
     *
     * Инвариант: методы форматирования вызываются только из геттера
     * `formattedTime` после проверки `isValid`, поэтому дата к этому
     * моменту всегда разобрана. Если проверка срабатывает — метод
     * вызван мимо `formattedTime` (ошибка программиста, а не данных).
     * @returns {Date} - Разобранная дата.
     * ***************************************************************************
     */
    private get _date(): Date {
        if (!this.date) {
            throw new Error("[TimeAgoFormatter]: дата не разобрана — методы форматирования вызваны мимо formattedTime");
        }
        return this.date;
    }

    constructor(
        date: Date | string | number | null | undefined,
        displayType: DisplayType = "telegram",
        locale: string = t("locale")
    ) {

        this.locale = locale;
        this.displayType = displayType;
        this.now = new Date();
        this.isValid = true;
        this.date = null;

        if (date === null || date === undefined || date === "") {
            this.isValid = false;
            return;
        }

        this.date = date instanceof Date ? date : new Date(date);

        if (isNaN(this.date.getTime())) {
            this.isValid = false;
            return;
        }
    }

    /**
     * Возвращает отформатированное значение.
     */
    get formattedTime(): string {
        if (!this.isValid) return "";

        switch (this.displayType) {
            case "long":
                return this._getLongFormat();
            case "date":
                return this._getDateOnlyFormat();
            case "datetime":
                return this._getDateTimeFormat();
            case "compact":
                return this._getCompactFormat();
            case "telegram":
                return this._getTelegramFormat();
            case "telegram-time":
                return this._getTelegramTimeFormat();
            case "telegram-list":
                return this._getTelegramListFormat();
            case "short":
            default:
                return this._getShortFormat();
        }
    }

    /* =========================================================================
       Абсолютные форматы
       ========================================================================= */

    _getDateOnlyFormat(): string {
        return new Intl.DateTimeFormat(this.locale, {
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(this._date);
    }

    _getDateTimeFormat(): string {
        const time = this._getTime();
        const date = this._getDateOnlyFormat();

        return this.locale.startsWith("ru")
            ? `В ${time}, ${date}`
            : `At ${time}, ${date}`;
    }

    _getLongFormat(): string {
        const time = this._getTime();
        const date = this._getDateOnlyFormat();
        const isToday = this._isToday();

        if (isToday) {
            return this.locale.startsWith("ru")
                ? `Сегодня в ${time}`
                : `Today at ${time}`;
        }

        return this.locale.startsWith("ru")
            ? `В ${time}, ${date}`
            : `At ${time}, ${date}`;
    }

    /* =========================================================================
       Telegram форматы
       ========================================================================= */

    /**
     * Полный формат Telegram (сообщение с датой, если это не сегодня)
     * Пример: "09:40" (сегодня), "14.02 в 09:40" (в этом году), "14 февраля 2025 г. в 09:40" (прошлые года)
     */
    _getTelegramFormat(): string {
        const time = this._getTime();
        const currentYear = this.now.getFullYear();
        const year = this._date.getFullYear();

        if (this._isToday()) {
            return time;
        }

        const dayMonth = new Intl.DateTimeFormat(this.locale, {
            day: "2-digit",
            month: "2-digit"
        }).format(this._date);

        if (this._isYesterday() || year === currentYear) {
            return this.locale.startsWith("ru")
                ? `${dayMonth} в ${time}`
                : `${dayMonth} at ${time}`;
        }

        const fullDate = this._getDateOnlyFormat();

        return this.locale.startsWith("ru")
            ? `${fullDate} в ${time}`
            : `${fullDate} at ${time}`;
    }

    /**
     * Только время (как плашка времени на баббле сообщения внутри чата)
     * Пример: "09:40"
     */
    _getTelegramTimeFormat(): string {
        return this._getTime();
    }

    /**
     * Формат как в боковой панели / списке диалогов Telegram
     * Пример: "09:40" (сегодня), "вчера" (вчера), "14.02" (в этом году), "14.02.2025" (ранее)
     */
    _getTelegramListFormat(): string {
        if (this._isToday()) {
            return this._getTime();
        }

        if (this._isYesterday()) {
            return this.locale.startsWith("ru") ? "вчера" : "yesterday";
        }

        const dayMonth = new Intl.DateTimeFormat(this.locale, {
            day: "2-digit",
            month: "2-digit"
        }).format(this._date);

        const currentYear = this.now.getFullYear();
        const year = this._date.getFullYear();

        if (year === currentYear) {
            return dayMonth;
        }

        return `${dayMonth}.${year}`;
    }

    /* =========================================================================
       Компактный формат
       ========================================================================= */

    _getCompactFormat(): string {
        const day = String(this._date.getDate()).padStart(2, "0");
        const month = String(this._date.getMonth() + 1).padStart(2, "0");
        const year = this._date.getFullYear();
        const currentYear = this.now.getFullYear();

        return year !== currentYear
            ? `${day}.${month}.${year}`
            : `${day}.${month}`;
    }

    /* =========================================================================
       Относительный формат (short)
       ========================================================================= */

    _getShortFormat(): string {
        const MS = {
            second: 1000,
            minute: 60 * 1000,
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
            year: 365 * 24 * 60 * 60 * 1000
        };

        const elapsed = this._date.getTime() - this.now.getTime();
        const abs = Math.abs(elapsed);

        const rtf = new Intl.RelativeTimeFormat(this.locale, {
            numeric: "auto",
            style: "long"
        });

        const format = (unit: Intl.RelativeTimeFormatUnit, value: number): string =>
            rtf.format(Math.round(value), unit);

        if (abs < MS.minute) return format("second", elapsed / MS.second);
        if (abs < MS.hour) return format("minute", elapsed / MS.minute);
        if (abs < MS.day) return format("hour", elapsed / MS.hour);
        if (abs < MS.month) return format("day", elapsed / MS.day);
        if (abs < MS.year) return format("month", elapsed / MS.month);
        return format("year", elapsed / MS.year);
    }

    /* =========================================================================
       Вспомогательные методы
       ========================================================================= */

    _getTime(): string {
        return new Intl.DateTimeFormat(this.locale, {
            hour: "2-digit",
            minute: "2-digit"
        }).format(this._date);
    }

    _isToday(): boolean {
        return this._date.toDateString() === this.now.toDateString();
    }

    _isYesterday(): boolean {
        const yesterday = new Date(this.now.getTime());
        yesterday.setDate(this.now.getDate() - 1);
        return this._date.toDateString() === yesterday.toDateString();
    }
}
