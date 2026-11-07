// Импортируем config
import type { EmojiCategory, EmojiItem } from "../../../config/emoji.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Emoji } from "../index.js";

/**
 * ***************************************************************************
 * EmojiCategoryItem - категория эмодзи в списке панели выбора.
 * Заголовок категории плюс сетка эмодзи; клик по эмодзи отдаёт его
 * обработчику выбора формы.
 * ***************************************************************************
 */
export class EmojiCategoryItem {

    /** Форма-владелец элемента. */
    form: Emoji;

    /** Данные категории. */
    data: EmojiCategory;

    /** DOM-элемент категории. */
    element: HTMLElement | null;

    /** Заголовок категории (DOM). */
    name: HTMLElement | null = null;

    /** Сетка эмодзи категории (DOM). */
    list: HTMLElement | null = null;

    /**
     * ***************************************************************************
     * Инициализация: принимает начальные данные.
     * @param form - Форма-владелец.
     * @param data - Данные категории.
     * ***************************************************************************
     */
    constructor(form: Emoji, data: EmojiCategory) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Устанавливаем начальные данные
        this._setup(this.data);

    }

    // ***************************************************************************
    // Шаблон элемента (Private Method)
    // Используем DOMParser для безопасного и чистого создания элемента
    // ***************************************************************************
    _template(): HTMLElement | null {

        // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
        return new DOMParser().parseFromString(`

            <div class="item flex flex-col gap-1">
                <span data-name class="text-secondary font-semibold"></span>
                <div data-list class="grid grid-cols-9 gap-0 overflow-hidden text-xl"></div>
            </div>
            
        `, "text/html").querySelector<HTMLElement>(".item");

    }

    // ***************************************************************************
    // Шаблон эмодзи (Private Method)
    // Используем DOMParser для безопасного и чистого создания элемента
    // ***************************************************************************
    _templateEmoji(): HTMLElement | null {

        // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
        return new DOMParser().parseFromString(`

            <div class="item p-1 rounded-lg font-emoji text-center hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer"></div>
            
        `, "text/html").querySelector<HTMLElement>(".item");

    }

    // ***************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // ***************************************************************************
    _setup(data: EmojiCategory): void {

        try {

            // Сохраняем актуальные данные
            this.data = data;

            // Записываем элементы
            this.name = this.element?.querySelector("[data-name]") ?? null;
            this.list = this.element?.querySelector("[data-list]") ?? null;

            // Название
            if (this.name) this.name.textContent = this.data.name;

            // Проходим по emoji
            this.data.items.forEach((emoji: EmojiItem) => {

                // Создаем элемент
                const item = this._templateEmoji();
                if (item) item.textContent = emoji.emoji;

                // Отображаем (без элемента вставлять нечего)
                if (item) this.list?.append(item);

                // Клик: возвращаем выбранный emoji
                item?.addEventListener("click", () => {
                    this.form.callback && this.form.callback(emoji)
                });

            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // ПУБЛИЧНЫЙ МЕТОД: Обновление элемента
    // ***************************************************************************
    update(data: EmojiCategory): void {

        // Передаем новые данные в _setup, чтобы перерисовать DOM
        this._setup(data);

    }

    // ***************************************************************************
    // Геттер для удобного получения элемента (вставки в DOM)
    // ***************************************************************************
    getDOM(): HTMLElement | null {
        return this.element;
    }

    // ***************************************************************************
    // Геттер для удобного получения data
    // ***************************************************************************
    getData(): EmojiCategory {
        return this.data;
    }

}
