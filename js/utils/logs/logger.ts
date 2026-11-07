/**
 * Имена уровней логирования.
 */
type LogLevelName = "DEBUG" | "INFO" | "WARN" | "ERROR" | "OFF";

/**
 * Методы console, которые использует Logger.
 */
type ConsoleMethod = "debug" | "info" | "warn" | "error";

/**
 * Класс Logger: Централизованный инструмент для логирования.
 * Управляет выводом в консоль, основываясь на установленном уровне.
 */
export class Logger {

    // ***************************************************************************
    // Уровни логирования
    // ***************************************************************************
    static LEVELS: Record<LogLevelName, number> = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        OFF: 4 // Отключить все логи
    };

    // Уровень, установленный по умолчанию (выводить все, кроме OFF)
    static currentLevel = Logger.LEVELS.DEBUG;

    /**
     * Является ли строка известным именем уровня логирования
     * (проверка по собственным ключам LEVELS, чтобы не поймать свойства
     * прототипа Object вроде "__proto__").
     * @param name - Имя уровня в верхнем регистре.
     */
    static isLevelName(name: string): name is LogLevelName {
        return Object.prototype.hasOwnProperty.call(Logger.LEVELS, name);
    }

    /**
     * ***************************************************************************
     * Устанавливает минимальный уровень логирования.
     * @param levelName - Имя уровня (например, "INFO", "ERROR").
     * ***************************************************************************
     */
    static setLevel(levelName: string): void {
        const name = levelName.toUpperCase();
        if (Logger.isLevelName(name)) {
            Logger.currentLevel = Logger.LEVELS[name];
            console.log(`[Logger] Уровень логирования установлен: ${name}`);
        } else {
            console.error(`[Logger] Ошибка: Неизвестный уровень логирования: ${levelName}`);
        }
    }

    /**
     * ***************************************************************************
     * Основной метод, который проверяет уровень и вызывает console.
     * @param level - Числовой уровень текущего сообщения.
     * @param method - Имя метода console (например, 'debug', 'info').
     * @param messages - Сообщения для вывода.
     * ***************************************************************************
     */
    static _log(level: number, method: ConsoleMethod, messages: readonly unknown[]): void {
        // Проверяем, что текущий уровень сообщения >= установленного
        if (level >= Logger.currentLevel) {
            const timestamp = new Date().toLocaleTimeString('ru-RU');
            const prefix = `[${timestamp}][${method.toUpperCase()}]`;

            // Проверяем наличие метода: fallback для нестандартных методов
            // (например, debug/trace в старых браузерах)
            if (console[method]) {
                console[method](prefix, ...messages);
            } else {
                console.log(prefix, ...messages);
            }
        }
    }

    // ***************************************************************************
    // 4. Публичные методы (Интерфейс)
    // ***************************************************************************
    static debug(...messages: unknown[]): void {
        Logger._log(Logger.LEVELS.DEBUG, 'debug', messages);
    }

    static info(...messages: unknown[]): void {
        Logger._log(Logger.LEVELS.INFO, 'info', messages);
    }

    static warn(...messages: unknown[]): void {
        Logger._log(Logger.LEVELS.WARN, 'warn', messages);
    }

    static error(...messages: unknown[]): void {
        Logger._log(Logger.LEVELS.ERROR, 'error', messages);
    }

}
