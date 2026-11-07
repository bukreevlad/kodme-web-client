// Импортируем сторонние пакеты
import Bowser from "bowser";

/**
 * ***************************************************************************
 * IsMobile - детект мобильного устройства (результат кэшируется).
 * ***************************************************************************
 */
export class IsMobile {

    // Устанавливаем параметры
    static isMobile: boolean | undefined;

    // ***************************************************************************
    // Установка
    // ***************************************************************************
    static get(): boolean {

        // Если данные уже есть
        if (typeof this.isMobile === "boolean") return this.isMobile;

        // Получаем userAgent браузера
        const userAgent = window.navigator.userAgent;

        // Парсим userAgent
        const parse = Bowser.parse(userAgent);

        // Записываем параметры и возвращаем ответ
        this.isMobile = parse.platform.type !== "desktop";
        return this.isMobile;

    }

}
