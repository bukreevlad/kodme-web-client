// Импортируем components
import { Buttons } from "./buttons.js";

// Импортируем utils
import { Icons } from "../utils/icons.js";
import { applyAttributes } from "../utils/dom/apply_attributes.js";

/**
 * Действие в пустом состоянии (CTA-кнопка).
 */
export interface EmptyStateAction {
    /** Текст кнопки. */
    text: string;
    /** Имя иконки слева от текста. */
    icon?: string | undefined;
    /** Обработчик нажатия. Если форма сама вешает слушатель через атрибут — не нужен. */
    onClick?: (() => void) | undefined;
    /** Атрибуты кнопки (для привязки обработчиков формой, например `"action-create"`). */
    attributes?: string[] | undefined;
}

/**
 * Настройки пустого состояния.
 */
export interface EmptyStateOptions {
    /** Заголовок (обязателен: пустое состояние без слова «почему» бесполезно). */
    title: string;
    /** Описание под заголовком. */
    description?: string | undefined;
    /** Имя иконки Tabler в круге сверху (по умолчанию — «корзина» inbox). */
    icon?: string | undefined;
    /** CTA-кнопка (например, «Создать», «Пригласить»). */
    action?: EmptyStateAction | undefined;
    /** Компактный вариант (меньшие отступы — для вложенных списков). */
    compact?: boolean | undefined;
    /** Атрибуты корневого элемента (`"data-empty"`, объекты `{name, value}`). */
    attributes?: string[] | { name: string; value?: string }[];
    /** Дополнительные CSS-классы. */
    classes?: string[];
}

/**
 * ***************************************************************************
 * EMPTY_STATE - единый компонент «здесь пока ничего нет».
 * ***************************************************************************
 *
 * Круглая иконка + заголовок + описание + опциональная CTA-кнопка. Раньше
 * такой блок был скопирован в десятках форм с разными отступами и цветами —
 * теперь все пустые состояния выглядят одинаково и настраиваются опциями.
 *
 * Для переключения «список ↔ пусто ↔ скелетон» используйте хелпер
 * `syncListState()` из этого же модуля.
 */
export class EmptyState {

    /** Настройки экземпляра (с дефолтами). */
    options: EmptyStateOptions & { icon: string; compact: boolean; attributes: (string | { name: string; value?: string })[]; classes: string[] };

    /** DOM-элемент состояния. */
    private _element: HTMLElement;

    /**
     * ***************************************************************************
     * @param {EmptyStateOptions} options - Настройки пустого состояния.
     * ***************************************************************************
     */
    constructor({
        title,
        description,
        icon = "inbox",
        action,
        compact = false,
        attributes = [],
        classes = []
    }: EmptyStateOptions) {
        this.options = { title, description, icon, action, compact, attributes, classes };
        this._element = this._createElement();
    }

    /**
     * ***************************************************************************
     * Создание DOM-дерева состояния.
     * @returns {HTMLElement} Внешний элемент состояния.
     * @private
     * ***************************************************************************
     */
    private _createElement(): HTMLElement {

        const wrapper = document.createElement("div");
        wrapper.className = [
            // Плашка занимает всё доступное место (flex-1/h-full задаёт форма),
            // но сама — без фона и скруглений: контент центрируется в зоне
            // списка. Фон/рамку списка задаёт сам список, а не пустое состояние
            "cdm-empty-state flex flex-col items-center justify-center gap-3 text-center w-full",
            this.options.compact ? "p-6" : "p-8",
            ...this.options.classes.filter(Boolean)
        ].join(" ");

        // Атрибуты (data-* маркеры форм, например data-empty)
        applyAttributes(wrapper, this.options.attributes);

        // Круг с иконкой: приглушённый контраст, чтобы не перетягивать взгляд
        const badge = document.createElement("div");
        badge.className = "flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-black)]/5 dark:bg-[var(--color-white)]/10 shrink-0";

        const iconElement = Icons.icon(this.options.icon, { settings: { size: 28 } });
        if (iconElement) {
            // Декоративная иконка: заголовок и так описывают ситуацию
            iconElement.setAttribute("aria-hidden", "true");
            iconElement.classList.add("text-[var(--text-muted)]");
            badge.appendChild(iconElement);
        }
        wrapper.appendChild(badge);

        // Текстовый блок: заголовок + опциональное описание
        const textBlock = document.createElement("div");
        textBlock.className = "flex flex-col gap-1";

        const title = document.createElement("p");
        title.className = "text-base font-semibold text-[var(--text-color)] leading-snug";
        title.textContent = this.options.title;
        textBlock.appendChild(title);

        if (this.options.description) {
            const description = document.createElement("p");
            description.className = "text-sm text-[var(--text-secondary)] leading-snug";
            description.textContent = this.options.description;
            textBlock.appendChild(description);
        }

        wrapper.appendChild(textBlock);

        // CTA-кнопка: через общий компонент кнопок — единый вид и поведение.
        // Обработчик может вешать и сама форма по атрибуту (тогда onClick не нужен)
        if (this.options.action) {
            const action = this.options.action;
            const button = Buttons.primary({
                text: action.text,
                icon: action.icon ?? null,
                size: "sm",
                attributes: [
                    { name: "data-empty-action", value: "" },
                    ...(action.attributes ?? [])
                ]
            });
            if (action.onClick) {
                button.dom.addEventListener("click", action.onClick);
            }
            wrapper.appendChild(button.dom);
        }

        return wrapper;

    }

    /**
     * ***************************************************************************
     * Геттеры.
     * ***************************************************************************
     */
    get dom() { return this._element; }
    get html() { return this._element.outerHTML; }

    // Умное приведение к строке для шаблонных литералов
    toString() { return this.html; }

    /**
     * ***************************************************************************
     * Фабрика пустого состояния.
     * @param {EmptyStateOptions} options - Настройки.
     * @returns {EmptyState} Экземпляр компонента.
     * ***************************************************************************
     */
    static create(options: EmptyStateOptions) {
        return new EmptyState(options);
    }

}

/**
 * Цели переключения состояния списка.
 */
export interface SyncListStateTargets {
    /** Элемент списка записей. */
    list: HTMLElement | null | undefined;
    /** Элемент пустого состояния. */
    empty: HTMLElement | null | undefined;
    /** Элемент скелетона (опционально: виден до первой загрузки). */
    skeleton?: HTMLElement | null | undefined;
}

/**
 * Данные для решения о состоянии.
 */
export interface SyncListStateData {
    /** Первая страница уже загружена. */
    loaded: boolean;
    /** Количество загруженных записей. */
    count: number;
}

/**
 * ***************************************************************************
 * syncListState - переключает «список ↔ пусто ↔ скелетон» по данным загрузки.
 * ***************************************************************************
 *
 * Общий хелпер вместо десятка копий `update_empty_state.ts` в формах. Пустоту
 * показываем только после первой загрузки: пока идёт первый запрос, непонятно —
 * «записей нет» или «ещё не загрузилось».
 *
 * Пара hidden/flex переключается по правилу Tailwind: при наличии обоих
 * классов побеждает `.hidden`, поэтому для скрытия
 * достаточно добавить `hidden`.
 *
 * @param {SyncListStateTargets} targets - DOM-элементы списка, пустого состояния и скелетона.
 * @param {SyncListStateData} data - Флаг загрузки и количество записей.
 * ***************************************************************************
 */
export function syncListState(targets: SyncListStateTargets, data: SyncListStateData): void {

    const { list, empty, skeleton } = targets;
    const isEmpty = data.loaded && data.count === 0;

    // Список прячем только когда пусто; при показе достаточно снять hidden —
    // display-класс (flex) уже стоит в разметке списка
    list?.classList.toggle("hidden", isEmpty);

    // Пустое состояние: при показе добавляем flex, иначе div останется блочным
    empty?.classList.toggle("hidden", !isEmpty);
    empty?.classList.toggle("flex", isEmpty);

    // Скелетон виден только до первой загрузки
    skeleton?.classList.toggle("hidden", data.loaded);

}
