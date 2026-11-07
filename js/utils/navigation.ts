// Импортируем utils
import { Logger } from "./logs/logger.js";

/**
 * Запись истории навигации.
 */
interface NavigationState {
    /** ID расположения. */
    id: string;
    /** URL расположения. */
    url: string;
    /** Экземпляр формы, которую закрывает системное действие «Назад». */
    instance?: {
        /** Закрыть форму. */
        close: () => void;
    } | null;
}

// Модуль: Navigation
export class Navigation {

    // Массив истории
    static states: NavigationState[] = [];

    /**
     * ***************************************************************************
     * Добавить новое расположение
     * @param {NavigationState} state - Данные расположения.
     * ***************************************************************************
     */
    static addState(state: NavigationState): void {

        try {

            this.states.push(state);
            history.pushState(state.id, "", state.url);

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Системное действие - Назад
     * @param {string} stateId - ID расположения.
     * ***************************************************************************
     */
    static popState(stateId: string): void {

        try {

            // Если есть история
            if (this.states.length > 0) {

                // Получаем последнюю запись
                let state = this.states[this.states.length - 1];
                if (state) {

                    // Закрываем форму
                    state?.instance?.close();

                    // Удаляем запись из истории
                    this.states = this.states.filter(s => s.id != state.id);

                }

            }

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
    * ***************************************************************************
    * Удалить расположение
    * @param {string} stateId - ID расположения.
    * ***************************************************************************
    */
    static removeState(stateId: string): void {

        try {

            // Если есть история
            if (this.states.length > 0) {

                // Форма которая закрывается
                this.states = this.states.filter(s => s.id != stateId);

                // Получаем последнюю запись
                let state = this.states[this.states.length - 1];

                // Если запись найдена
                if (state) {

                    // Заменяем на новое расположение
                    history.replaceState(state.id, "", state.url);

                } else {

                    // Заменяем на новое расположение
                    history.replaceState("", "", "/");

                }

            }

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Переместить существующее состояние в конец истории (сделать активным)
     * @param {string} stateId - ID расположения.
     * ***************************************************************************
     */
    static updateState(stateId: string): void {

        try {

            const stateIndex = this.states.findIndex(s => s.id === stateId);
            if (stateIndex !== -1) {
                // Извлекаем состояние
                const state = this.states.splice(stateIndex, 1)[0];
                if (!state) return;
                // Кладем в конец (теперь оно последнее)
                this.states.push(state);
                // Обновляем URL в браузере
                history.replaceState(state.id, "", state.url);
            }

        } catch (error) {
            Logger.error(error);
        }
        
    }

}