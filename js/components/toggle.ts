// Импортируем utils
import { Logger } from "../utils/logs/logger.js";
import { Icons } from "../utils/icons.js";

/**
 * Тип отображения переключателя: свитч, классический чекбокс, радиокнопка
 * или «строка-карточка» внутри группы вариантов (см. `Toggle.cardGroup`).
 */
export type ToggleType = "switch" | "checkbox" | "radio" | "card";

/**
 * Динамический текст в зависимости от состояния инпута.
 */
export interface ToggleText {
    /** Текст, когда включен (checked). */
    on: string;
    /** Текст, когда выключен (unchecked). */
    off?: string;
}

/**
 * Атрибут для реального input: голое имя (`"data-audio"`), строка со значением
 * (`"data-layout=grid"`) либо объект `{ name, value }`.
 */
export type ToggleAttribute = string | { name: string; value?: string };

/**
 * Настройки переключателя.
 */
export interface ToggleOptions {
    /** Имя инпута для отправки в формах (критично для radio). */
    name?: string;
    /** Значение инпута для отправки в формах (критично для radio). */
    value?: string;
    /** Обычный статичный текст (если нужен всегда один). */
    text?: string;
    /** Текст с мелким описанием. */
    description?: string;
    /** Имя иконки Tabler слева от текста. */
    icon?: string;
    /** Динамический текст в зависимости от состояния. */
    toggleText?: ToggleText;
    /** Тип отображения. */
    type?: ToggleType;
    /** Начальное состояние. */
    checked?: boolean;
    /** Дополнительные классы для контейнера. */
    classes?: string[];
    /** Атрибуты для реального input. */
    attributes?: ToggleAttribute[];
}

/**
 * Настройки экземпляра после применения дефолтов конструктора.
 */
interface ResolvedToggleOptions {
    /** Имя инпута. */
    name?: string | undefined;
    /** Значение инпута. */
    value?: string | undefined;
    /** Статичный текст. */
    text?: string | undefined;
    /** Описание. */
    description?: string | undefined;
    /** Имя иконки Tabler. */
    icon?: string | undefined;
    /** Динамический текст. */
    toggleText?: ToggleText | undefined;
    /** Тип отображения. */
    type: ToggleType;
    /** Флаг начального состояния. */
    checked: boolean;
    /** Дополнительные классы контейнера. */
    classes: string[];
    /** Атрибуты input. */
    attributes: ToggleAttribute[];
}

/**
 * Цель гидратации: элемент, список элементов, документ либо компонент
 * с геттером `dom`.
 */
export type ToggleHydrateTarget = HTMLElement | HTMLElement[] | Document | { dom?: Element | null };

/**
 * Конфигурация одного типа переключателя: классы индикатора и опциональный
 * собственный контейнер (только у карточки).
 */
interface ToggleTypeConfig {
    /** Собственный контейнер (переопределяет базовый набор классов). */
    container?: string;
    /** CSS-классы кастомного индикатора. */
    indicator: string;
    /** Дополнительные CSS-классы (псевдоэлементы, галочка). */
    extra: string;
}

export class Toggle {

    // 1. Делаем контейнер relative, чтобы инпут мог растянуться внутри него
    static #containerBase = "flex items-center gap-3 font-semibold cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none relative";
    static #inputBase = "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 peer";
    static #indicatorBase = "shrink-0 transition-all duration-200";

    // Варианты переключателей (Свитч, классический Чекбокс, Радиокнопка или Карточка).
    // Фокус-кольцо вешаем peer-focus-visible на индикатор: реальный input
    // прозрачный, его собственный outline пользователь не видит
    static #types: Record<ToggleType, ToggleTypeConfig> = {
        switch: {
            indicator: "w-11 h-7 bg-[var(--color-black)]/15 dark:bg-[var(--color-white)]/25 rounded-full relative peer-checked:bg-[var(--color-brand)] peer-active:scale-95 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-brand)] transition-colors duration-200",
            extra: "after:content-[''] after:absolute after:left-0.5 after:top-1/2 after:-translate-y-1/2 after:bg-white after:rounded-full after:h-6 after:w-6 after:shadow-xs after:transition-all after:duration-200 after:ease-out peer-checked:after:translate-x-4"
        },
        checkbox: {
            // Галочка — дочерний svg индикатора, поэтому её видимость вешаем
            // через descendant-варианты самого индикатора: peer-вариант работает
            // только для соседей по `~`, и на ребёнке он никогда не срабатывал
            indicator: "w-6 h-6 border-2 border-[var(--color-black)]/25 dark:border-[var(--color-white)]/35 rounded-lg flex items-center justify-center peer-checked:bg-[var(--color-brand)] peer-checked:border-[var(--color-brand)] peer-hover:border-[var(--color-black)]/45 dark:peer-hover:border-[var(--color-white)]/55 peer-active:scale-95 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-brand)] text-white transition-colors duration-200 [&_svg]:opacity-0 [&_svg]:transition-opacity peer-checked:[&_svg]:opacity-100 [&>span]:opacity-0 [&>span]:transition-opacity peer-checked:[&>span]:opacity-100",
            extra: ""
        },
        radio: {
            // Круглая радиокнопка с точкой по центру через псевдоэлемент after
            indicator: "w-6 h-6 border-2 border-[var(--color-black)]/25 dark:border-[var(--color-white)]/35 rounded-full relative peer-checked:border-[var(--color-brand)] peer-hover:border-[var(--color-black)]/45 dark:peer-hover:border-[var(--color-white)]/55 peer-active:scale-95 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-brand)] transition-colors duration-200",
            extra: "after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-full after:rounded-full after:border-[0.35rem] after:border-transparent peer-checked:after:border-[var(--color-brand)] after:scale-0 after:transition-all peer-checked:after:scale-100"
        },
        // «Строка-карточка» внутри группы: вся строка кликабельна, при выборе
        // подсвечивается брендовым фоном, справа появляется галочка в кружке.
        // Рамку, фон и скругление задаёт группирующая обёртка (см.
        // #cardGroupClasses), поэтому строка без рамки и лишь подсвечивается
        // при наведении и выборе
        card: {
            container: "w-full items-center gap-2.5 p-2.5 transition-colors duration-150 cursor-pointer has-checked:bg-[var(--color-brand)]/10 hover:bg-[var(--second-bg)] dark:hover:bg-[var(--color-white)]/[0.04] has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[var(--color-brand)]",
            indicator: "ml-auto shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 scale-90 peer-checked:scale-100 bg-[var(--color-black)]/10 dark:bg-[var(--color-white)]/15 peer-checked:bg-[var(--color-brand)]",
            extra: "[&_svg]:w-4 [&_svg]:h-4 [&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100 [&_svg]:transition-opacity [&_svg]:duration-200 text-white"
        }
    };

    // Группирующий контейнер: единый закруглённый бокс с разделителями между
    // строками — так группа радио-вариантов выглядит цельно, а не набором
    // отдельных карточек с отступами
    static #cardGroupClasses = "flex flex-col overflow-hidden rounded-lg border border-[var(--border-color)] divide-y divide-[var(--border-color)]";

    /** Настройки экземпляра (с дефолтами из конструктора). */
    options: ResolvedToggleOptions;

    /** Корневой элемент (label-контейнер, создаётся в _createElement). */
    private _element: HTMLLabelElement;

    /** Скрытый реальный input (чекбокс или радио, создаётся в _createElement). */
    private _inputElement: HTMLInputElement;

    /**
     * @param {ToggleOptions} options - Настройки переключателя
     */
    constructor({
        name,
        value,
        text,
        description,
        toggleText,
        icon,
        type = "switch",
        checked = false,
        classes = [],
        attributes = []
    }: ToggleOptions = {}) {
        this.options = { name, value, text, description, toggleText, icon, type, checked, classes, attributes };

        // Узлы создаются одним методом и присваиваются здесь: конструктор
        // должен инициализировать свойства сам, а не делегировать это методу
        const created = this._createElement();
        this._element = created.root;
        this._inputElement = created.input; // ссылка на инпут для работы геттеров/сеттеров
    }

    /**
     * ***************************************************************************
     * Создание DOM-дерева переключателя.
     * @returns {{ root: HTMLLabelElement; input: HTMLInputElement }} - Готовый label-контейнер и скрытый инпут.
     * ***************************************************************************
     */
    private _createElement(): { root: HTMLLabelElement; input: HTMLInputElement } {

        // Создаем контейнер-label, чтобы клик по тексту тоже триггерил переключение
        const label = document.createElement("label");
        const typeConfig = Toggle.#types[this.options.type] || Toggle.#types.switch;

        // Для карточек берём собственный контейнер (полноширинный, без отступа сверху)
        const containerBase = this.options.type === "card" ? Toggle.#containerBase.replace("pt-0.5", "") : Toggle.#containerBase;
        const containerClasses = [containerBase, typeConfig.container || "", ...this.options.classes].filter(Boolean).join(" ");
        label.classList.add(...Toggle.#normalizeClasses(containerClasses));

        // Помечаем контейнер дата-атрибутом, чтобы метод hydrate мог легко найти его на странице
        label.setAttribute("data-toggle-root", "");

        // Скрытый инпут (наш главный "Peer" для CSS-магии)
        const input = document.createElement("input");

        // Если тип 'radio' или 'card', создаем радио-инпут, иначе стандартный чекбокс
        input.type = (this.options.type === "radio" || this.options.type === "card") ? "radio" : "checkbox";

        if (this.options?.name) input.name = this.options?.name;
        if (this.options?.value) input.value = this.options?.value;

        // Настройка состояния. Важно: setAttribute нужен для корректного рендера в шаблонных строках через .outerHTML
        input.checked = this.options?.checked;
        if (this.options?.checked) {
            input.setAttribute("checked", "");
        }

        input.classList.add(...Toggle.#normalizeClasses(Toggle.#inputBase));

        // Кастомный визуальный индикатор
        const indicator = document.createElement("span");
        const indicatorClasses = [Toggle.#indicatorBase, typeConfig.indicator, typeConfig.extra].filter(Boolean).join(" ");
        indicator.classList.add(...Toggle.#normalizeClasses(indicatorClasses));

        // Если выбран тип 'card', вставляем иконку галочки внутрь кружка
        if (this.options.type === "card") {
            const checkIcon = Icons?.icon ? Icons.icon("check") : null;
            if (checkIcon) {
                indicator.appendChild(checkIcon);
            } else {
                indicator.innerHTML = '<span class="leading-none">✓</span>';
            }
        }

        // Если выбран тип 'checkbox', пытаемся вставить иконку галочки
        if (this.options.type === "checkbox") {
            const checkIcon = Icons?.icon ? Icons.icon("check") : null;
            if (checkIcon) {
                // Видимостью галочки управляет индикатор через peer-checked:[&_svg]
                // (см. конфиг checkbox): peer-вариант работает только для соседей
                // по `~`, а иконка — ребёнок индикатора, и на ней он не срабатывал
                checkIcon.classList.add("w-3", "h-3", "stroke-[3]");
                indicator.appendChild(checkIcon);
            } else {
                // Фолбек, если глобальный хелпер иконок недоступен
                indicator.innerHTML = '<span class="text-xs leading-none">✓</span>';
            }
        }

        // Атрибуты (современный dataset или setAttribute) — переносим именно на input, а не на label

        // У radio и карточки `value` — идентичность варианта, а не служебное
        // поле: значит, пустой `data-*` рядом с ним читать как источник
        // данных нельзя. Проверка вынесена сюда, до цикла, чтобы не искать
        // тип и значение на каждом атрибуте
        const isOptionValue = (this.options.type === "radio" || this.options.type === "card") && Boolean(this.options.value);

        this.options.attributes.forEach(attr => {
            if (!attr) return;

            if (typeof attr === 'string' && attr.includes('=')) {
                const [name = '', ...valueParts] = attr.split('=');
                input.setAttribute(name, valueParts.join('='));
            } else if (typeof attr === 'object' && attr.name) {
                input.setAttribute(attr.name, attr.value || '');
            } else if (typeof attr === 'string') {

                // Голое имя ставится пустым — так и задумано: это крючок
                // присутствия (`required`, `data-audio`), значение в нём
                // не предусмотрено. Но у radio и карточки `value` — это
                // сам выбор, и data-атрибут без значения в такой связке
                // почти наверняка ошибка вызова: обработчик получит `""`
                // вместо данных и молча ничего не сделает. Молчаливую
                // поломку делаем заметной.
                if (isOptionValue && attr.startsWith("data-")) {
                    Logger.warn(`[Toggle]: Атрибут «${attr}» поставлен без значения — читать из него нечего, будет пустая строка. Значение варианта у radio и карточки — «${this.options.value}»; чтобы атрибут что-то вез, передайте «${attr}=...» или { name: "${attr}", value }`);
                }

                input.setAttribute(attr, "");
            }
        });

        // Сборка структуры: инпут ВСЕГДА идет первым, чтобы Tailwind-селектор `peer-...` на индикаторах работал корректно
        label.appendChild(input);

        // ***************************************************************************
        // Обработка логики текста (Динамический vs Статический + Поддержка Description)
        // ***************************************************************************
        const hasText = this.options.text || (this.options.toggleText && this.options.toggleText.on);
        let textContainer: HTMLDivElement | null = null;

        // Иконка слева от текста. Необязательная: без неё разметка
        // собирается ровно как раньше, поэтому старые вызовы не затронуты.
        // Иконка — указатель, чем строка является (камера, микрофон, режим
        // сетки), поэтому приглушаем её и запрещаем сжиматься
        let iconElement: SVGSVGElement | null = null;
        if (this.options.icon && Icons?.icon) {
            iconElement = Icons.icon(this.options.icon, { classes: ["shrink-0", "text-muted"] });
        }

        if (hasText) {
            // Создаем текстовый контейнер, чтобы заголовок и описание шли колонкой справа от кружка
            textContainer = document.createElement("div");
            textContainer.classList.add("flex", "flex-col", "gap-0.5", "leading-tight");

            // 1. Рендерим основной текст (динамический или статичный)
            if (this.options.toggleText && this.options.toggleText.on && this.options.toggleText.off) {
                const textOn = document.createElement("span");
                textOn.textContent = this.options.toggleText.on;
                // Используем peer-checked на спанах, но так как они внутри div, 
                // нам нужно, чтобы сам div транслировал peer-чек наружу.
                // Для этого мы на спаны вешаем зависимость от общего peer (инпута):
                textOn.classList.add("hidden", "peer-checked:block");

                const textOff = document.createElement("span");
                textOff.textContent = this.options.toggleText.off;
                textOff.classList.add("block", "peer-checked:hidden");

                textContainer.appendChild(textOn);
                textContainer.appendChild(textOff);
            } else if (this.options.text) {
                const textSpan = document.createElement("span");
                textSpan.textContent = this.options.text;

                // В карточке заголовок оставляем обычным (не жирным), как в списках настроек
                if (this.options.type !== "card") textSpan.classList.add("font-semibold");
                textContainer.appendChild(textSpan);
            }

            // 2. Рендерим описание под текстом, если оно передано
            if (this.options.description) {
                const descSpan = document.createElement("span");
                descSpan.textContent = this.options.description;
                descSpan.classList.add("text-sm", "text-secondary", "dark:text-secondary", "font-normal");
                textContainer.appendChild(descSpan);
            }

            // ВАЖНО: Чтобы peer-checked:block работал внутри textContainer,
            // сам textContainer ДОЛЖЕН разделять селектор peer. В Tailwind это делается добавлением класса peer к самому контейнеру,
            // НО правильнее управлять вложенными элементами через селектор родителя или сделать инпут родителем group.
            // Самый простой способ без изменения стилей спанов — добавить класс "peer" и на сам textContainer, 
            // но Tailwind скомпилирует `peer-checked:block` как поиск соседа.

            // Чтобы всё завелось по классике CSS без переписывания Tailwind классов на спанах,
            // мы просто уберем textContainer для динамического свитча БЕЗ description, 
            // а ЕСЛИ description есть — применим селектор через pure CSS/Tailwind:

            // В карточке текст идёт слева, а галочка справа — поэтому
            // textContainer добавляем ДО индикатора только для типа "card".
            if (this.options.type === "card") {
                if (iconElement) label.appendChild(iconElement);
                label.appendChild(textContainer);
            }

            // Исправляем видимость спанов с учетом вложенности:
            // Мы можем сказать «покажи этот спан, если ПРЕДЫДУЩИЙ сосед-инпут чекнут» через класс на самом textContainer:
            textContainer.classList.add("peer", "peer-checked:[&>.hidden]:block", "peer-checked:[&>.block]:hidden");
        }

        // Иконка встаёт перед текстом, индикатор — после. В карточке это
        // даёт «иконка + текст … галочка», в остальных типах —
        // «переключатель + иконка + текст»
        if (iconElement && this.options.type !== "card") {
            label.appendChild(iconElement);
        } else if (iconElement && !textContainer) {
            // Карточка без текста, но с иконкой: иначе иконка потерялась бы
            label.appendChild(iconElement);
        }

        // Индикатор добавляем ПОСЛЕ текста — так в карточке текст будет слева, а галочка справа
        label.appendChild(indicator);

        // Для остальных типов (switch/checkbox/radio) текст идёт после индикатора — прежний порядок
        if (textContainer && this.options.type !== "card") {
            label.appendChild(textContainer);
        }

        return { root: label, input };

    }

    /**
     * ***************************************************************************
     * Геттеры и Сеттеры
     * ***************************************************************************
     */
    get dom() { return this._element; }
    get html() { return this._element.outerHTML; }
    get checked() { return this._inputElement.checked; }

    // Позволяет динамически менять состояние из JS кода и синхронизировать HTML-атрибуты
    set checked(value) {
        const isChecked = Boolean(value);
        this._inputElement.checked = isChecked;
        if (isChecked) {
            this._inputElement.setAttribute("checked", "");
        } else {
            this._inputElement.removeAttribute("checked");
        }
    }

    // Умное приведение к строке для шаблонных литералов `${Toggle...}`
    toString() { return this.html; }

    /**
     * ***************************************************************************
     * Статический метод оживления (гидратации) элементов после строкового рендера
     * @param {ToggleHydrateTarget} [target=document] - Контейнер, массив элементов, документ или компонент с dom
     * ***************************************************************************
     */
    static hydrate(target: ToggleHydrateTarget = document) {
        let roots: Element[] = [];

        // 1. Анализируем что пришло на вход: массив элементов, один элемент или контейнер
        if (Array.isArray(target)) {
            roots = target.filter(el => el && el.hasAttribute?.("data-toggle-root"));
        } else if (target instanceof HTMLElement && target.hasAttribute("data-toggle-root")) {
            roots = [target];
        } else {
            // Компонент с dom-геттером либо сам элемент/документ
            let context: Element | Document | null = null;
            if ("dom" in target && target.dom) {
                context = target.dom;
            } else if (target instanceof Element || target instanceof Document) {
                context = target;
            }

            if (context) {
                roots = Array.from(context.querySelectorAll("[data-toggle-root]"));
            }
        }

        // 2. Навешиваем обработчики и оживляем
        roots.forEach(root => {
            const input = root.querySelector<HTMLInputElement>("input[type='checkbox'], input[type='radio']");
            if (!input || root.hasAttribute("data-toggle-hydrated")) return;

            // Умная функция синхронизации свойства и HTML-атрибута
            const syncState = () => {
                if (input.type === "radio" && input.name) {
                    // Особая магия для радио: если это группа, находим ВСЕ радиокнопки с этим именем в документе/форме
                    const rootForm: ParentNode = input.form || document;
                    const radioGroup = rootForm.querySelectorAll<HTMLInputElement>(`input[type='radio'][name='${input.name}']`);

                    // Синхронизируем текстовые атрибуты у всей группы, так как у них событие change не сработает автоматически
                    radioGroup.forEach(radio => {
                        if (radio.checked) {
                            radio.setAttribute("checked", "");
                        } else {
                            radio.removeAttribute("checked");
                        }
                    });
                } else {
                    // Стандартная логика для чекбоксов и свитчей
                    if (input.checked) {
                        input.setAttribute("checked", "");
                    } else {
                        input.removeAttribute("checked");
                    }
                }
            };

            // Слушаем изменения на инпуте
            input?.addEventListener("change", syncState);

            // Помечаем, что элемент успешно "оживлен"
            root.setAttribute("data-toggle-hydrated", "");
        });
    }

    /**
     * ***************************************************************************
     * Статические фабричные методы
     * ***************************************************************************
     */

    // Базовый метод создания общего экземпляра
    static create(options?: ToggleOptions) { return new Toggle(options); }

    // Быстрое создание переключателя типа Switch
    static switch(options: ToggleOptions = {}) { return new Toggle({ ...options, type: "switch" }); }

    // Быстрое создание обычного Чекбокса
    static checkbox(options: ToggleOptions = {}) { return new Toggle({ ...options, type: "checkbox" }); }

    // Быстрое создание Радиокнопки
    static radio(options: ToggleOptions = {}) { return new Toggle({ ...options, type: "radio" }); }

    /**
     * ***************************************************************************
     * cardGroup - группа вариантов выбора как единый закруглённый контейнер.
     *
     * Рендерит набор radio-карточек безрамочными строками внутри общего бокса
     * с разделителями (divide-y): цельный вид вместо отдельных карточек с
     * отступами. Возвращает готовую HTML-строку для вставки в шаблон.
     * @param {ToggleOptions[]} options - Настройки вариантов (тип форсируется в card).
     * @returns {string} - HTML группирующего контейнера со строками.
     * ***************************************************************************
     */
    static cardGroup(options: ToggleOptions[]): string {
        return Toggle.cardGroupDom(options).outerHTML;
    }

    /**
     * ***************************************************************************
     * cardGroupDom - группа вариантов как единый контейнер в виде DOM-элемента.
     *
     * То же, что cardGroup, но возвращает готовый элемент — для мест, где строки
     * вставляются через replaceChildren/append, а не интерполяцией в шаблон
     * (например, списки устройств в настройках встречи).
     * @param {ToggleOptions[]} options - Настройки вариантов (тип форсируется в card).
     * @returns {HTMLElement} - Группирующий контейнер со строками.
     * ***************************************************************************
     */
    static cardGroupDom(options: ToggleOptions[]): HTMLElement {

        // Контейнер-обёртка: единый закруглённый бокс с разделителями
        const container = document.createElement("div");
        container.classList.add(...Toggle.#cardGroupClasses.split(" "));

        // Каждый вариант — карточка-строка внутри общего контейнера
        options.forEach(opt => {
            container.appendChild(new Toggle({ ...opt, type: "card" }).dom);
        });

        return container;

    }

    /**
     * ***************************************************************************
     * Нормализация строки классов в массив токенов.
     * Убирает пустые и повторяющиеся пробелы — защита от DOMException
     * "The empty string is not a valid token" при classList.add.
     * @param {String} str - Строка классов.
     * @returns {String[]} - Массив валидных токенов.
     * ***************************************************************************
     */
    static #normalizeClasses(str: string): string[] {
        return String(str || "").trim().split(/\s+/).filter(Boolean);
    }
}