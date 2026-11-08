// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем forms
import { ChannelProfile } from "../../channel-profile/index.js";

// Импортируем типы
import { isGroupTopicRecord } from "../types.js";
import type { GroupTopicsManager } from "../index.js";
import type { GroupTopicRecord } from "../types.js";

/**
 * ***************************************************************************
 * THEME_ITEM - строка темы в списке менеджера тем группы.
 *
 * Строка подписывается на `item::updated::<id>` локального стора формы и
 * держит ссылку на себя в `data.__domElements__`, чтобы стор удалил все
 * копии разом. В DOM строка вставляется через её поле `element`.
 * ***************************************************************************
 */
export class ThemeItem {

    /** Форма-владелец строки. */
    form: GroupTopicsManager;

    /** Данные строки (запись темы из стора). */
    data: GroupTopicRecord;

    /** DOM-элемент строки. */
    element: HTMLElement;

    /**
     * ***************************************************************************
     * Создать строку темы.
     * @param form - Форма-владелец.
     * @param data - Данные темы.
     * ***************************************************************************
     */
    constructor(form: GroupTopicsManager, data: GroupTopicRecord) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Записываем ссылку на dom элемент
        if (!this.data.__domElements__) {
            this.data.__domElements__ = [];
        }
        this.data.__domElements__.push(this.element);

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Подписываем на обновление
        this._subscribeToUpdates();

    }

    // *************************************************************************
    // Шаблон элемента (Private Method)
    // Используем DOMParser для безопасного и чистого создания элемента
    // *************************************************************************
    _template(): HTMLElement {

        // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
        const element = new DOMParser().parseFromString(`
            <div class="item flex flex-col gap-0 w-full p-2 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg cursor-pointer">
                <span data-display-name class="font-semibold truncate"></span>
                <span data-author class="text-sm text-secondary truncate"></span>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
        if (!element) throw new Error("Не найден шаблон: .item");

        return element;

    }

    // *************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // *************************************************************************
    _setup(data: GroupTopicRecord): void {

        try {

            // Сохраняем актуальные данные
            this.data = data;

            // Устанавливаем элементы
            let name = this.element.querySelector<HTMLElement>(":scope [data-display-name]");
            let author = this.element.querySelector<HTMLElement>(":scope [data-author]");

            // Отображаем данные
            if (name) name.textContent = data.display_name ?? null;
            if (author) author.textContent = data.author_name ?? null;

        } catch (error) {
            Logger.error(error);
        }

    }

    // *************************************************************************
    // ПУБЛИЧНЫЙ МЕТОД: Обновление элемента
    // @param data - Новые данные темы.
    // *************************************************************************
    update(data: GroupTopicRecord): void {

        // Передаем новые данные в _setup, чтобы перерисовать DOM
        this._setup(data);

    }

    // *************************************************************************
    // Подписка на точечное событие обновления (Private Method)
    // *************************************************************************
    _subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события: шаблон передаётся в вызов
            // напрямую — промежуточная const схлопнула бы шаблонный литерал
            // в string, не проходящий в тип события стора
            let unsubscribe = this.form.store.on(`item::updated::${this.data.id}`, (data) => {

                // Пейлоад типизирован как unknown: перерисовываем строку
                // только если пришла запись темы
                if (isGroupTopicRecord(data)) this.update(data);

            });

            // Сохраняем функцию отписки в data, чтобы стор мог вызвать её при удалении
            this.data.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    }

}
