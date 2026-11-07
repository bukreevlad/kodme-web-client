/**
 * ***************************************************************************
 * TextareaAutosize - автовысота текстового поля.
 * ***************************************************************************
 */
export class TextareaAutosize {

    /** Текстовое поле. */
    el: HTMLTextAreaElement;

    /** Максимальная высота поля в пикселях. */
    maxHeight: number;

    /**
     * ***************************************************************************
     * Автовысота текстового поля.
     * @param el - Textarea-элемент.
     * @param maxHeight - Максимальная высота поля. По умолчанию 350.
     * ***************************************************************************
     */
    constructor(el: HTMLTextAreaElement, maxHeight = 350) {
        this.el = el;
        this.maxHeight = maxHeight;
        this.init();
    }

    // Инициализация
    init(): void {

        this.el.style.resize = 'none';
        this.el.style.maxHeight = `${this.maxHeight}px`;
        this.el.style.overflowY = 'hidden';

        this.update = this.update.bind(this);
        this.el?.addEventListener('input', this.update);
        this.update();

    }

    // Обновить автовысоту
    update(): void {
        this.el.style.height = 'auto';
        const newHeight = this.el.scrollHeight;

        this.el.style.height = `${newHeight}px`;

        if (newHeight > this.maxHeight) {
            this.el.style.overflowY = 'auto';
        } else {
            this.el.style.overflowY = 'hidden';
        }
    }

    // Отключить слежение
    destroy(): void {
        this.el.removeEventListener('input', this.update);
    }

}
