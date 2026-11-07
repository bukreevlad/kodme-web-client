// Импортируем utils
import { LocalStorage } from "./local_storage.js";
import type { RadiusKey, StoredSession } from "./local_storage.js";
import { Logger } from "./logs/logger.js";

/**
 * ***************************************************************************
 * Decorations - применение локальных настроек оформления пользователя.
 * Настройки хранятся в сессии (LocalStorage) в session.settings.user.decorations
 * и применяются через CSS-переменные и атрибуты на корневом элементе (<html>).
 *
 * Порядок работы:
 *  - На старте приложения вызывается Decorations.apply(session) (см. main.js);
 *  - При изменении настройки в форме handler сохраняет значение в сессию
 *    и вызывает Decorations.apply() для мгновенного применения без перезагрузки.
 * ***************************************************************************
 */
export class Decorations {

    // Множители скругления интерфейса к базовым значениям --radius-* из css/main.css
    static radius: Record<RadiusKey, number> = {
        compact: 0.75,
        default: 1,
        round: 1.5
    };

    // Базовые значения скруглений (rem). Должны совпадать с @theme в css/main.css
    static #baseRadius = {
        "sm": 0.375,
        "md": 0.5,
        "lg": 0.75,
        "xl": 1,
        "2xl": 1.5,
        "3xl": 2,
        "4xl": 2.5
    };

    /**
     * ***************************************************************************
     * Применяем все настройки оформления из сессии к корневому элементу.
     * @param {StoredSession | null} [session] - Сессия пользователя. По умолчанию LocalStorage.session.
     * ***************************************************************************
     */
    static apply(session: StoredSession | null = LocalStorage.session): void {

        try {

            // Достаём настройки оформления (сессии старых версий могут быть неполными)
            const decorations = session?.settings?.user?.decorations;

            // Корневой элемент
            const root = document.documentElement;

            // ==================================
            // 1. Акцентный цвет
            // ==================================

            // Если пользователь выбрал свой цвет - задаём его, иначе возвращаем
            // управление теме (убираем инлайновое значение)
            if (decorations?.brand_color) {
                root.style.setProperty("--color-brand", decorations.brand_color);
            } else {
                root.style.removeProperty("--color-brand");
            }

            // ==================================
            // 2. Скругление интерфейса
            // ==================================

            // Множитель скруглений (undefined - настройка по умолчанию)
            const radiusScale = decorations ? this.radius[decorations.ui_radius] : undefined;
            if (radiusScale && radiusScale !== 1) {

                // Масштабируем все токены радиусов
                Object.entries(this.#baseRadius).forEach(([name, value]) => {
                    root.style.setProperty(`--radius-${name}`, `${value * radiusScale}rem`);
                });

            } else {

                // Сбрасываем - пусть работают значения из темы
                Object.keys(this.#baseRadius).forEach(name => {
                    root.style.removeProperty(`--radius-${name}`);
                });

            }

        } catch (error) {
            Logger.error(error);
        }

    }

}
