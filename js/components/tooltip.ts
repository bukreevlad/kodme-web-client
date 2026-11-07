/**
 * ***************************************************************************
 * TOOLTIP - делегированный всплывающий текст по data-tooltip-атрибуту.
 * ***************************************************************************
 *
 * Работает без локальной инициализации каждого элемента: один глобальный
 * слушатель на документ находит ближайший `[data-tooltip]` от точки входа
 * события. Достаточно добавить атрибут в любую разметку — шаблон, строку
 * списка, кнопку.
 *
 * Поведение (WAI-ARIA-подобное):
 * - по наведению мыши — через короткую задержку (не мигает при скольжении);
 * - по фокусу с клавиатуры — мгновенно;
 * - на тач-устройствах тултип не показывается (там нет hover, а вспышка
 *   после тапа только мешает);
 * - связь «элемент → тултип» описывается `aria-describedby`, сам тултип —
 *   `role="tooltip"` и один на весь документ;
 * - закрытие: уход мыши, blur, Escape, любой скролл.
 *
 * Инициализация: `Tooltip.init()` в точке входа (идемпотентно).
 */
export class Tooltip {

    /** Единственный DOM-элемент тултипа (создаётся лениво). */
    static #element: HTMLElement | null = null;

    /** Флаг однократной инициализации глобальных слушателей. */
    static #initialized = false;

    /** Таймер задержки показа по наведению. */
    static #hoverTimer: number | null = null;

    /** Элемент, для которого сейчас показан/подготовлен тултип. */
    static #currentTarget: HTMLElement | null = null;

    /** Задержка показа при наведении (мс): убирает мерцание при скольжении. */
    static #HOVER_DELAY = 400;

    /**
     * ***************************************************************************
     * Подключает глобальные слушатели (вызывать один раз из main.ts).
     * ***************************************************************************
     */
    static init(): void {

        if (Tooltip.#initialized) return;
        Tooltip.#initialized = true;

        // Capture-фаза: ловим события до всплытия и независимо от того,
        // где именно в DOM лежит элемент с data-tooltip
        document.addEventListener("pointerover", Tooltip.#handlePointerOver, true);
        document.addEventListener("pointerout", Tooltip.#handlePointerOut, true);
        document.addEventListener("focusin", Tooltip.#handleFocusIn, true);
        document.addEventListener("focusout", Tooltip.#handleFocusOut, true);
        document.addEventListener("keydown", Tooltip.#handleKeydown, true);

        // Скролл в любом контейнере прячет тултип: его позиция «приклеена»
        // к элементу, и при прокрутке текст оказался бы не на месте
        window.addEventListener("scroll", Tooltip.hide, true);

    }

    /**
     * ***************************************************************************
     * Создаёт (лениво) и возвращает общий элемент тултипа.
     * @returns {HTMLElement} Элемент тултипа.
     * @private
     * ***************************************************************************
     */
    static #ensureElement(): HTMLElement {

        if (Tooltip.#element) return Tooltip.#element;

        const element = document.createElement("div");
        element.id = "ui-tooltip";
        element.setAttribute("role", "tooltip");
        element.className = [
            "ui-tooltip fixed z-[120] max-w-64 px-2.5 py-1.5",
            "text-xs font-medium leading-snug rounded-lg shadow-xs",
            "bg-[var(--text-color)] text-[var(--bg-color)]",
            "pointer-events-none hidden"
        ].join(" ");

        document.body.appendChild(element);
        Tooltip.#element = element;

        return element;

    }

    /**
     * ***************************************************************************
     * Находит элемент-носитель тултипа от любого узла события.
     * @param {EventTarget|null} node - Узел события.
     * @returns {HTMLElement|null} Элемент с data-tooltip либо null.
     * @private
     * ***************************************************************************
     */
    static #findTarget(node: EventTarget | null): HTMLElement | null {
        if (!(node instanceof Element)) return null;
        return node.closest<HTMLElement>("[data-tooltip]");
    }

    /**
     * ***************************************************************************
     * Наведение мыши/пальца: готовим показ с задержкой.
     * @param {PointerEvent} event - Событие pointerover.
     * @private
     * ***************************************************************************
     */
    static #handlePointerOver = (event: PointerEvent): void => {

        // На тач-устройствах hover нет: вспышка после тапа мешает навигации
        if (event.pointerType === "touch") return;

        const target = Tooltip.#findTarget(event.target);
        if (!target || target === Tooltip.#currentTarget) return;

        // Меняем цель — сбрасываем предыдущий показ
        Tooltip.hide();
        Tooltip.#currentTarget = target;

        Tooltip.#hoverTimer = window.setTimeout(() => {
            Tooltip.#hoverTimer = null;
            Tooltip.#show(target);
        }, Tooltip.#HOVER_DELAY);

    };

    /**
     * ***************************************************************************
     * Уход мыши: прячем, если курсор ушёл за пределы элемента.
     * @param {PointerEvent} event - Событие pointerout.
     * @private
     * ***************************************************************************
     */
    static #handlePointerOut = (event: PointerEvent): void => {

        const target = Tooltip.#findTarget(event.target);
        if (!target || target !== Tooltip.#currentTarget) return;

        // Смежные элементы (иконка внутри кнопки) не должны прятать тултип
        if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;

        Tooltip.hide();

    };

    /**
     * ***************************************************************************
     * Фокус с клавиатуры: показываем мгновенно, без задержки.
     * @param {FocusEvent} event - Событие focusin.
     * @private
     * ***************************************************************************
     */
    static #handleFocusIn = (event: FocusEvent): void => {

        const target = Tooltip.#findTarget(event.target);
        if (!target || target === Tooltip.#currentTarget) return;

        Tooltip.hide();
        Tooltip.#currentTarget = target;
        Tooltip.#show(target);

    };

    /**
     * ***************************************************************************
     * Потеря фокуса: прячем.
     * @param {FocusEvent} event - Событие focusout.
     * @private
     * ***************************************************************************
     */
    static #handleFocusOut = (event: FocusEvent): void => {

        const target = Tooltip.#findTarget(event.target);
        if (!target || target !== Tooltip.#currentTarget) return;

        Tooltip.hide();

    };

    /**
     * ***************************************************************************
     * Escape: закрывает тултип независимо от источника.
     * @param {KeyboardEvent} event - Событие keydown.
     * @private
     * ***************************************************************************
     */
    static #handleKeydown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") Tooltip.hide();
    };

    /**
     * ***************************************************************************
     * Показывает тултип у элемента и позиционирует его (сверху, либо снизу,
     * если сверху нет места; края экрана не вылезают).
     * @param {HTMLElement} target - Элемент-носитель data-tooltip.
     * @private
     * ***************************************************************************
     */
    static #show(target: HTMLElement): void {

        const text = target.getAttribute("data-tooltip");
        if (!text) return;

        const element = Tooltip.#ensureElement();
        element.textContent = text;
        element.classList.remove("hidden");

        // Геометрия считается после показа: до снятия hidden размеры нулевые
        const targetRect = target.getBoundingClientRect();
        const tipRect = element.getBoundingClientRect();

        // Сверху по центру; если не хватает места — под элементом
        let top = targetRect.top - tipRect.height - 8;
        if (top < 8) top = targetRect.bottom + 8;

        // По центру элемента с зажимом по краям экрана
        let left = targetRect.left + targetRect.width / 2 - tipRect.width / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

        // Позиция — runtime-геометрия, её нельзя выразить статичным классом
        element.style.top = `${top}px`;
        element.style.left = `${left}px`;

        // Связываем для скринридера: описание исчезнет вместе с тултипом
        if (!target.id) {
            target.id = `tooltip-target-${Math.random().toString(36).slice(2, 9)}`;
        }
        target.setAttribute("aria-describedby", element.id);

    }

    /**
     * ***************************************************************************
     * Прячет тултип и снимает связь с элементом.
     * ***************************************************************************
     */
    static hide(): void {

        // Сбрасываем и таймер, чтобы «хвост» задержки не показал тултип уже
        // после ухода мыши
        if (Tooltip.#hoverTimer !== null) {
            clearTimeout(Tooltip.#hoverTimer);
            Tooltip.#hoverTimer = null;
        }

        Tooltip.#element?.classList.add("hidden");
        Tooltip.#currentTarget?.removeAttribute("aria-describedby");
        Tooltip.#currentTarget = null;

    }

}
