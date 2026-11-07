// Импортируем сторонние пакеты
import type { OverlayScrollbars } from "overlayscrollbars";

/**
 * ***************************************************************************
 * ScrollManager - менеджер прокрутки списка поверх OverlayScrollbars.
 * Отвечает за состояние прокрутки, действия (к низу/к верху) и логику
 * якоря: удержание видимого сообщения на месте при обновлении списка.
 * ***************************************************************************
 */
export class ScrollManager {

    /** Инстанс OverlayScrollbars, которым управляет менеджер. */
    os: OverlayScrollbars;

    /** Элемент-контейнер прокрутки (viewport инстанса). */
    viewport: HTMLElement;

    /** Сохранённый якорь: элемент и его смещение относительно viewport. */
    anchor: { el: Element; offset: number } | null = null;

    /** Флаг активности: при false якорение не выполняется. */
    enabled = true;

    /**
     * ***************************************************************************
     * @param {OverlayScrollbars} osInstance - Инстанс OverlayScrollbars.
     * ***************************************************************************
     */
    constructor(osInstance: OverlayScrollbars) {
        this.os = osInstance;
        this.viewport = osInstance.elements().viewport;
    }

    // ============================
    // State
    // ============================

    /**
     * Текущее состояние прокрутки: позиция, полная высота и высота окна.
     */
    getScrollState() {
        return {
            top: this.viewport.scrollTop,
            height: this.viewport.scrollHeight,
            client: this.viewport.clientHeight
        };
    }

    /**
     * Проверяет, находится ли прокрутка у нижней границы.
     * @param threshold - Допустимое расстояние до низа в пикселях.
     */
    isAtBottom(threshold = 50) {
        const { top, height, client } = this.getScrollState();
        return height - (top + client) < threshold;
    }

    // ============================
    // Actions
    // ============================

    /**
     * Прокручивает список к нижнему краю.
     * @param behavior - Поведение прокрутки (по умолчанию без анимации).
     */
    scrollToBottom(behavior: ScrollBehavior = "auto") {
        this.viewport.scrollTo({
            top: this.viewport.scrollHeight,
            behavior
        });
    }

    /**
     * Прокручивает список к верхнему краю.
     */
    scrollToTop() {
        this.viewport.scrollTop = 0;
    }

    // ============================
    // Anchor logic (KEY FEATURE)
    // ============================

    /**
     * Запоминает первое видимое сообщение и его смещение относительно
     * верхней границы viewport.
     */
    saveAnchor() {
        if (!this.enabled) return;

        const viewportRect = this.viewport.getBoundingClientRect();

        // ищем первое ВИДИМОЕ сообщение
        const children = this.viewport.querySelectorAll("[data-id]");
        for (const el of children) {
            const rect = el.getBoundingClientRect();

            // первый элемент, который хотя бы частично виден
            if (rect.bottom > viewportRect.top) {
                this.anchor = {
                    el,
                    offset: rect.top - viewportRect.top
                };
                return;
            }
        }

        this.anchor = null;
    }

    /**
     * Восстанавливает позицию сохранённого якоря после обновления списка.
     */
    restoreAnchor() {
        if (!this.enabled) return;
        if (!this.anchor) return;

        const { el, offset } = this.anchor;

        // элемент мог исчезнуть (редко, но возможно)
        if (!el.isConnected) {
            this.anchor = null;
            return;
        }

        const viewportRect = this.viewport.getBoundingClientRect();
        const rect = el.getBoundingClientRect();

        const delta = rect.top - viewportRect.top - offset;
        this.viewport.scrollTop += delta;

        this.anchor = null;
    }

    // ============================
    // Safe update
    // ============================

    /**
     * Обновляет инстанс OverlayScrollbars (с инвалидацией кэша размеров).
     */
    update() {
        this.os.update(true);
    }

    /**
     * Обновляет инстанс и восстанавливает якорь на следующем кадре.
     */
    updateAndRestoreAnchor() {
        if (!this.enabled) return;
        requestAnimationFrame(() => {
            this.update();
            this.restoreAnchor();
        });
    }
}
