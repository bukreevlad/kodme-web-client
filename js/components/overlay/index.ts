// Импортируем utils
import { LayerStack } from "../../utils/layer_stack.js";
import { Navigation } from "../../utils/navigation.js";

// Импортируем capabilities
import { CAPABILITIES } from "./capabilities/index.js";

// Импортируем presets
import { PRESETS } from "./presets/index.js";

// Импортируем типы
import type {
    OverlayCapability,
    OverlayCloseMeta,
    OverlayLike,
    OverlayOptions,
    OverlayPreset,
    ResolvedOverlayOptions
} from "./types.js";

/**
 * ***************************************************************************
 * OVERLAY - базовый контейнер для всех слоёв поверх интерфейса.
 * ***************************************************************************
 *
 * Оверлей — это обёртка (затемнение + окно), которая монтируется в DOM,
 * анимируется и закрывается. Форма-экран, диалог и поповер отличаются тремя
 * вещами: разметкой обёртки, дефолтами настроек и анимациями. Всё это описано
 * в пресетах (`presets/`), а всё общее — здесь.
 *
 * Типы настроек (включая описание всех опций) лежат в `types.ts`.
 *
 * Почему пресет, а не одна большая фабрика:
 * если разложить различия по флагам в общем списке опций, то у вызывающего
 * окажется ~35 ключей, половина из которых для его типа не делает ничего
 * (`targetNode` у формы-экрана, `closeOnSwipe` у диалога). Пресет отдаёт
 * контейнеру только те настройки, которые ему положены.
 *
 * Что НЕ входит в базовый класс:
 * - позиционирование по якорю (общий расчёт лежит в
 *   `utils/dom/anchored_positioner.js`, а когда его применять — в капабилти
 *   `window_geometry`);
 * - safe-area, свайпы, перетаскивание — это капабилти (`capabilities/`);
 * - геометрия контекстных меню со своей логикой переворота.
 *
 * Интерфейс капабилти (`capabilities/`):
 * - `state`   — начальные значения, которые кладутся на экземпляр;
 * - `methods` — методы, которые копируются на экземпляр;
 * - `init`         — до монтирования в DOM;
 * - `onMounted`    — после монтирования, до `onOpen`;
 * - `afterOpen`    — после `onOpen`;
 * - `destroy`      — при закрытии.
 *
 * Интерфейс пресета (`presets/`):
 * - `name`, `rootClass`, `overlaySelector` — оформление;
 * - `options`        — дефолты типа;
 * - `prepare`        — предобработка настроек (мобильные переопределения);
 * - `template`       — разметка обёртки;
 * - `initWrap`       — подготовка обёртки перед монтированием;
 * - `cancelOnBeforeOpen`, `awaitOnOpen` — как тип трактует хуки;
 * - `openContentAnimation`, `openOverlayAnimation`,
 *   `closeAnimations`, `closeOverlayAnimations` — анимации;
 * - `canClose`       — есть ли что снимать с DOM.
 *
 * Обратной совместимости с отдельными классами форм и диалогов больше нет:
 * тип приходит из места вызова (`new Overlay(tpl, { type: "modal" })`),
 * и все 116 вызовов в `js/` проверены тестом `tests/overlay_lifecycle.test.js`.
 * ***************************************************************************
 */
export class Overlay implements OverlayLike {

    /** Пресет типа (находится по опции `type`). */
    preset: OverlayPreset;

    /** Имя типа (ключ реестра пресетов). */
    type: string;

    /** Нормализованные настройки (дефолты пресета + вызов + UUID). */
    options: ResolvedOverlayOptions;

    /** Разметка обёртки (создаётся при открытии). */
    tpl: HTMLElement | null;

    /** Обёртка слоя (равна `tpl`). */
    wrap: HTMLElement | null;

    /** Элемент затемнения внутри обёртки. */
    overlay: HTMLElement | null;

    /** Контент слоя (к моменту монтирования — всегда элемент). */
    content: HTMLElement;

    /** Флаг закрытия: защищает от повторного close() и от Escape во время анимации. */
    isClosing: boolean;

    /** Подключённые капабилти типа. */
    capabilities: OverlayCapability[];

    /** Связанный обработчик клавиатуры. */
    boundHandleKeydown: (event: KeyboardEvent) => void;

    /** Связанный обработчик клика по оверлею. */
    boundHandleOverlayClick: (event: MouseEvent) => void;

    /** Связанный обработчик ресайза/скролла (для привязки к window капабилти). */
    boundResize: EventListener | null;

    /** Элемент, с которого открыли слой: на него возвращается фокус после закрытия. */
    private _focusReturnTarget: HTMLElement | null;

    /** Селектор фокусируемых элементов для ловушки фокуса диалога. */
    static #focusableSelector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled]):not([type=\"hidden\"])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "summary",
        "[tabindex]:not([tabindex=\"-1\"])",
        "[contenteditable=\"true\"]"
    ].join(",");

    /** Первичная расстановка окна (назначается капабилти геометрии). */
    _setPosition?: () => void;

    /**
     * ***************************************************************************
     * Создаёт экземпляр оверлея.
     * @param {HTMLElement} content - Контент, который будет показан в окне.
     *   Строка отклоняется: её нужно разобрать через `DOMParser` (см. `_createElements`).
     * @param {OverlayOptions} options - Настройки. Обязательна опция `type` —
     *   имя типа из реестра пресетов (`"form"`, `"modal"`, `"popover"`).
     * @throws {Error} Если `type` не передан или неизвестен.
     * ***************************************************************************
     */
    constructor(content: HTMLElement, options: OverlayOptions) {

        // Тип задаёт пресет: неизвестный `type` — явное падение, а не
        // молчаливый откат, иначе забытый тип дал бы оверлей не того типа
        // (чужой z-index, другое поведение закрытия)
        const preset = PRESETS[options.type];

        if (!preset) {
            throw new Error(
                `Overlay: не указан или неизвестен type (${JSON.stringify(options.type)}). `
                + `Доступные типы: ${Object.keys(PRESETS).join(", ")}`
            );
        }

        this.preset = preset;
        this.type = this.preset.name;

        // `prepare` может переопределить опции (например, на мобильных)
        const prepared = typeof this.preset.prepare === "function"
            ? this.preset.prepare({ ...options })
            : { ...options };

        this.options = {
            id: (typeof self !== "undefined" && self.crypto?.randomUUID)
                ? self.crypto.randomUUID()
                : `overlay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            ...this.preset.options,
            ...prepared,
            // Хуки жизненного цикла нормализуем до функции: без дефолта
            // открытие/закрытие упало бы на вызове undefined. Пресеты задают
            // свои хуки, но контракт (ResolvedOverlayOptions) не полагается
            // на это молча.
            onBeforeOpen: prepared.onBeforeOpen ?? this.preset.options.onBeforeOpen ?? (async () => { }),
            onOpen: prepared.onOpen ?? this.preset.options.onOpen ?? (() => { }),
            onBeforeClose: prepared.onBeforeClose ?? this.preset.options.onBeforeClose ?? (async () => { }),
            onAfterClose: prepared.onAfterClose ?? this.preset.options.onAfterClose ?? (() => { })
        };

        // Элементы
        this.tpl = null;
        this.wrap = null;
        this.overlay = null;
        this.content = content;

        /** Флаг закрытия: защищает от повторного close() и от Escape во время анимации */
        this.isClosing = false;

        // Возврат фокуса: целевой элемент запоминается при открытии
        this._focusReturnTarget = null;

        // Капабилти: сначала состояние, потом методы
        this.capabilities = (this.preset.capabilities || [])
            .map(name => CAPABILITIES[name])
            .filter(Boolean);

        for (const capability of this.capabilities) {
            Object.assign(this, capability.state || {});
            Object.assign(this, capability.methods || {});
        }

        // Публичные методы самого типа (например `setWrapPadding` у модалки)
        Object.assign(this, this.preset.methods || {});

        // Связываем контекст для обработчиков
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        this.boundHandleOverlayClick = this.handleOverlayClick.bind(this);

        // Позиционирование есть не у всех типов, поэтому привязка условная
        this.boundResize = typeof this._setPosition === "function"
            ? this._setPosition.bind(this)
            : null;

    }

    /**
     * ***************************************************************************
     * Создаёт DOM-элементы обёртки и оверлея.
     * @returns {HTMLElement} Созданная обёртка (`tpl`/`wrap`).
     * @private
     * ***************************************************************************
     */
    _createElements(): HTMLElement {

        // Устанавливаем шаблон
        this.tpl = this.template();

        // Определяем элементы
        this.wrap = this.tpl;
        this.overlay = this.tpl.querySelector<HTMLElement>(this.preset.overlaySelector);

        // Подготовка обёртки (отступы, прозрачный оверлей — что требует тип)
        this.preset.initWrap?.(this);

        // Контент обязан быть элементом: строка молча дала бы пустую обёртку
        // (диалог без окна, меню без пунктов) — её разбираем через DOMParser
        if (!(this.content instanceof HTMLElement)) {
            const received = this.content === null
                ? "null"
                : Array.isArray(this.content)
                    ? "массив"
                    : typeof this.content;

            throw new Error(
                `[Overlay] content должен быть HTMLElement, получено: ${received}. ` +
                `Строку нужно разобрать: new DOMParser().parseFromString(html, "text/html").querySelector(".<класс>")`
            );
        }

        // Модалка навешивает корневой класс сама, форма — уже несёт его
        // в своей разметке, и добавлять второй раз не нужно.
        if (this.preset.forceRootClass && this.preset.rootClass) {
            this.content.classList.add(this.preset.rootClass);
        }

        this.wrap.appendChild(this.content);

        return this.tpl;

    }

    /**
     * ***************************************************************************
     * Добавляет обработчики событий.
     * @private
     * ***************************************************************************
     */
    _attachEvents() {

        // Слушатель нужен и для Escape, и для ловушки фокуса (Tab)
        if (this.options.closeOnEsc || this.options.focusTrap) {
            document?.addEventListener("keydown", this.boundHandleKeydown);
        }

        if (this.options.closeOnOverlay) {
            this.overlay?.addEventListener("click", this.boundHandleOverlayClick);
        }

    }

    /**
     * ***************************************************************************
     * Удаляет обработчики событий.
     *
     * Снятие выполняется безусловно: `removeEventListener` с той же ссылкой
     * на функцию, которой не было, ничего не делает и не бросает.
     * @private
     * ***************************************************************************
     */
    _detachEvents() {

        document?.removeEventListener("keydown", this.boundHandleKeydown);

        if (this.overlay) {
            this.overlay.removeEventListener("click", this.boundHandleOverlayClick);
        }

    }

    /**
     * ***************************************************************************
     * Обработчик нажатия клавиш: ловушка фокуса (Tab) и закрытие по Escape.
     * @param {KeyboardEvent} event - Событие клавиатуры.
     * ***************************************************************************
     */
    handleKeydown(event: KeyboardEvent) {

        // Реагирует только самый верхний слой: одновременно открыто несколько
        // оверлеев, и одно нажатие не должно обрабатываться всеми сразу.
        if (!LayerStack.isTop(this)) return;

        // Пока идёт анимация закрытия — повторно не реагируем
        if (this.isClosing) return;

        // Ловушка фокуса: Tab/Shift+Tab циклятся внутри контента диалога
        if (event.key === "Tab" && this.options.focusTrap) {
            this._handleFocusTrap(event);
            return;
        }

        if (event.key !== "Escape") return;

        // Слушатель может быть подключён из-за ловушки фокуса, а закрытие
        // по Escape этому типу не положено — проверяем опцию явно
        if (!this.options.closeOnEsc) return;

        this.close();

    }

    /**
     * ***************************************************************************
     * Собирает фокусируемые элементы внутри контента слоя (для ловушки фокуса).
     * Невидимые и disabled исключаются — по ним Tab не должен «перескакивать».
     * @returns {HTMLElement[]} Массив фокусируемых элементов.
     * @private
     * ***************************************************************************
     */
    private _getFocusableElements(): HTMLElement[] {

        const content = this.content;
        if (!(content instanceof HTMLElement)) return [];

        return Array.from(content.querySelectorAll<HTMLElement>(Overlay.#focusableSelector))
            .filter(element => !element.hasAttribute("disabled")
                && (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0));

    }

    /**
     * ***************************************************************************
     * Ловушка фокуса: Tab и Shift+Tab циклятся по элементам контента диалога,
     * фокус не «уходит» за пределы модального окна (требование WAI-ARIA).
     * @param {KeyboardEvent} event - Событие Tab.
     * @private
     * ***************************************************************************
     */
    private _handleFocusTrap(event: KeyboardEvent) {

        const content = this.content;
        if (!(content instanceof HTMLElement)) return;

        const focusable = this._getFocusableElements();
        const first = focusable[0] ?? null;
        const last = focusable[focusable.length - 1] ?? null;
        const active = document.activeElement;

        // Фокус вне диалога или внутри нет ни одного элемента — держим его
        // на контенте окна (у него tabindex=-1, заданный при открытии)
        if (!first || !last || !active || !content.contains(active)) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
            return;
        }

        // С краёв списка переходим «по кругу» на противоположный край
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }

    }

    /**
     * ***************************************************************************
     * Обработчик клика по оверлею.
     * @param {MouseEvent} event - Событие мыши.
     * ***************************************************************************
     */
    handleOverlayClick(event: MouseEvent) {

        // Проверяем, что клик был именно по оверлею, а не по окну внутри него
        if (event.target === this.overlay) {
            this.close();
        }

    }

    /**
     * ***************************************************************************
     * Прогоняет один из этапов капабилти по всем подключённым капабилти.
     * @param {"init"|"onMounted"|"afterOpen"|"destroy"} stage - Имя этапа.
     * @private
     * ***************************************************************************
     */
    _runCapabilities(stage: "init" | "onMounted" | "afterOpen" | "destroy") {
        for (const capability of this.capabilities) {
            capability[stage]?.(this);
        }
    }

    /**
     * ***************************************************************************
     * Запускает анимации открытия.
     *
     * Не ждём их завершения: `open()` дожидается только хуков и подготовки,
     * иначе вызывающий ждал бы зря — показ не должен блокировать отрисовку
     * уже смонтированного окна. Итоговые кадры фиксируем inline-стилями,
     * чтобы после `cancel()` элемент не «прыгнул».
     * @private
     * ***************************************************************************
     */
    _playOpenAnimations() {

        const animations: Animation[] = [];

        const contentAnimation = this.preset.openContentAnimation?.(this);
        if (contentAnimation) animations.push(contentAnimation);

        const overlayAnimation = this.preset.openOverlayAnimation?.(this);
        if (overlayAnimation) animations.push(overlayAnimation);

        if (animations.length === 0) return;

        Promise.all(animations.map(animation => animation.finished))
            .finally(() => {
                animations.forEach(animation => {
                    // `effect` базовый тип без `target` — целевым узлом обладает именно KeyframeEffect
                    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
                    if (target && target.isConnected) {
                        animation.commitStyles(); // Сохраняет финальное состояние как inline-стиль
                        animation.cancel(); // Останавливает анимацию
                    }
                });
            });

    }

    /**
     * ***************************************************************************
     * Монтирует оверлей в DOM и запускает открытие.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async open() {

        // Запоминаем элемент, с которого открыли слой: после закрытия фокус
        // вернётся на него — иначе с клавиатуры пользователь «повисает» на body.
        // Делаем до onBeforeOpen: хук асинхронный и мог бы сместить фокус.
        if (this.options.focusReturn) {
            const active = document.activeElement;
            this._focusReturnTarget = active instanceof HTMLElement ? active : null;
        }

        // BEFORE OPEN: Выполняем действие до начала открытия
        const onBeforeOpenResult = await this.options.onBeforeOpen();

        // Тип решает, отменяет ли `false` открытие: у формы-экрана — да
        // (она могла размонтироваться, пока грузились данные), у диалога — нет.
        if (this.preset.cancelOnBeforeOpen && onBeforeOpenResult === false) {
            this.close();
            return;
        }

        // Сбрасываем защиту от повторного закрытия (оверлей мог быть открыт ранее)
        this.isClosing = false;

        // Если обёртка ещё не создана — создаём и дальше работаем с локальной
        // ссылкой (после _createElements() элемент гарантированно существует)
        const wrap = this.wrap ?? this._createElements();

        // Устанавливаем действия
        this._attachEvents();

        // Капабилти, которым нужны слушатели до монтирования
        this._runCapabilities("init");

        // Проверка insertInto
        if (!this.options.insertInto) {
            document.body.appendChild(wrap);
        } else {
            this.options.insertInto.appendChild(wrap);
        }

        // Регистрируем слой: он смонтирован и теперь самый верхний
        LayerStack.push(this);

        // Анимации появления
        this._playOpenAnimations();

        // Капабилти, которым нужен уже смонтированный элемент (safe-area,
        // позиционирование): до `onOpen`, чтобы вызывающий видел готовую
        // геометрию.
        this._runCapabilities("onMounted");

        // OPEN: Выполняем действие сразу после добавления в DOM
        if (this.preset.awaitOnOpen) {
            await this.options.onOpen();
        } else {
            this.options.onOpen();
        }

        // Капабилти, которым нужно отработать пользовательский код (свайпы,
        // перетаскивание окна)
        this._runCapabilities("afterOpen");

        // Переводим фокус внутрь диалога, если он туда не попал сам (автофокус
        // в onOpen уважаем — не перехватываем). Нужно для ловушки: Tab начинается
        // от контента, а не от элемента под закрытым окном.
        if (this.options.focusTrap) {
            const active = document.activeElement;
            if (!active || active === document.body || !wrap.contains(active)) {
                this.content.setAttribute("tabindex", "-1");
                this.content.focus({ preventScroll: true });
            }
        }

        // Модуль: navigation
        if (this.options.url) {
            Navigation.addState({
                id: this.options.id,
                url: this.options.url,
                instance: this,
            });
        }

    }

    /**
     * ***************************************************************************
     * Закрывает оверлей: снимает слушатели, дожидается анимаций, удаляет из DOM.
     * @param {OverlayCloseMeta} [meta] - Метаданные закрытия.
     * @param {number} [meta.startX=0] - Смещение контента, если закрытие идёт свайпом.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async close(meta: OverlayCloseMeta = {}) {

        // Закрытие могло быть вызвано несколькими источниками сразу
        // (Escape, оверлей, кнопка «назад») — обрабатываем один раз
        if (this.isClosing) return;
        this.isClosing = true;

        // Снимаем слой со стека сразу, чтобы он перестал реагировать на Escape
        LayerStack.remove(this);

        // Выполняем действие перед удалением из DOM
        await this.options.onBeforeClose();

        // Если есть что снимать (canClose проверяет и обёртку, и оверлей)
        const wrap = this.wrap;
        if (wrap && this.preset.canClose(this)) {

            this._detachEvents();
            this._runCapabilities("destroy");

            const animations = [
                ...(this.preset.closeAnimations?.(this, meta) || []),
                ...(this.preset.closeOverlayAnimations?.(this, meta) || [])
            ];

            // Ждём завершения анимаций нативно через await, иначе
            // `await close()` возвращался бы раньше, чем элемент исчез из DOM.
            if (animations.length > 0) {
                await Promise.all(animations.map(animation => animation.finished));
            }

            // Очищаем DOM и вызываем коллбек
            wrap.remove();
            this.options.onAfterClose();

            // Возвращаем фокус на элемент-триггер: после удаления окна он
            // «повисает» на body. Проверка activeElement не даёт перехватить
            // фокус у более нового слоя, открытого поверх этого.
            if (this.options.focusReturn) {
                const target = this._focusReturnTarget;
                this._focusReturnTarget = null;

                const active = document.activeElement;
                if (target && target.isConnected && (!active || active === document.body)) {
                    target.focus({ preventScroll: true });
                }
            }
        }

        // Модуль: navigation
        if (this.options.url) {
            Navigation.removeState(this.options.id);
        }

    }

    /**
     * ***************************************************************************
     * Активировать оверлей (вывести на передний план).
     *
     * Порядок важен: сначала переключение таба, потом подъём слоя. Если
     * поменять их местами, `Escape` в момент переключения отработает не по
     * той форме, которую пользователь открыл.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async activate() {

        // 1. Сообщаем TabsManager через событие, что нужно переключить таб
        window.dispatchEvent(new CustomEvent("[app][form]::activate", {
            detail: { id: this.options.id }
        }));

        // 2. Поднимаем слой: переключение таба выводит оверлей на передний план,
        //    и Escape должен закрывать именно его, а не тот, что смонтирован позже
        LayerStack.raise(this);

        // 3. Обновляем навигацию (поднимаем в стеке и меняем URL)
        if (this.options.url) {
            Navigation.updateState(this.options.id);
        }

    }

    /**
     * ***************************************************************************
     * Шаблон обёртки. Разметка — целиком в пресете типа.
     * @returns {HTMLElement} Разборный DOM-элемент обёртки.
     * ***************************************************************************
     */
    template() {
        return this.preset.template();
    }

}
