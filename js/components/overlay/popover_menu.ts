// Импортируем utils
import { Icons } from "../../utils/icons.js";
import { LocalStorage } from "../../utils/local_storage.js";

/**
 * Пункт контекстного меню: описание (текст, иконка, действие) либо
 * уже свёрстанный узел, который добавляется как есть.
 */
export interface PopoverMenuItem {
    /** Текст элемента меню. */
    text: string;
    /** Имя для иконки. */
    iconName?: string;
    /** Действие при нажатии: получает событие и описание пункта. */
    onClick?: (event: MouseEvent, item: PopoverMenuItem) => void;
    /** Если true, отображает разделитель. */
    isSeparator?: boolean;
    /** Дополнительные классы. */
    cssClasses?: string[];
    /** Пункт — текущий выбор (подсветка строки и галочка справа). */
    isActive?: boolean;
}

/**
 * Элемент списка меню: описание пункта либо готовый DOM-узел.
 */
export type PopoverMenuInput = PopoverMenuItem | Node;

/**
 * ***************************************************************************
 * CREATE_POPOVER_MENU - собирает DOM контекстного меню из списка пунктов.
 *
 * `Overlay` принимает уже готовый элемент (`content`): эта функция делает
 * из пунктов разметку, а закрытие по клику по пункту держит пресет
 * (по атрибуту `data-popover-item`).
 *
 * Класс `cdm-context-menu` обязателен: по нему
 * `forms/meet-play/functions/shortcuts.js` определяет, что открыто
 * контекстное меню, и не отдаёт ему клавиши.
 *
 * Готовые DOM-узлы из списка добавляются как есть и автоматического
 * закрытия не получают.
 *
 * @param {PopoverMenuInput[]} items - Список пунктов меню.
 * @returns {HTMLElement} Готовый элемент меню для передачи в `Overlay`.
 */
export function createPopoverMenu(items: PopoverMenuInput[]) {

    const menu = document.createElement("div");

    menu.classList.add(
        "cdm-context-menu",
        "p-2",
        "max-w-[26rem]",
        "max-h-full",
        "h-fit",
        "rounded-md",
        "shadow-xl",
        "inset-ring",
        "inset-ring-black/10",
        "dark:inset-ring-white/10"
    );

    // Абсолютное позиционирование ставим сразу: расчёт координат случится
    // позже, и на один кадр иначе элемент мигнул бы в центре обёртки
    menu.style.position = "absolute";

    // Получаем параметр Blur из настроек пользователя
    const isBlur = LocalStorage?.session?.settings?.user?.decorations?.blur || false;

    if (isBlur) {
        // Поверхность меню — та же, что у модалок (тема адаптируется сама)
    menu.classList.add("bg-[var(--modal-bg)]/80", "backdrop-blur-[20px]");
    } else {
        menu.classList.add("bg-white", "dark:bg-[var(--modal-bg)]");
    }

    items.forEach(item => {
        if (item instanceof Node) {
            menu.appendChild(item);
            return;
        }

        const element = createMenuItem(item);
        if (element) menu.appendChild(element);
    });

    return menu;

}

/**
 * ***************************************************************************
 * Создаёт DOM-элемент одного пункта меню.
 * @param {PopoverMenuItem} item - Описание пункта.
 * @returns {HTMLElement|null} Элемент пункта или null.
 */
function createMenuItem(item: PopoverMenuItem) {

    if (item.isSeparator) {
        const separator = document.createElement("div");
        separator.classList.add("separator");
        return separator;
    }

    const itemElement = document.createElement("div");

    itemElement.classList.add(
        "item",
        "flex",
        "flex-row",
        "gap-3",
        "p-2",
        "transition-colors",
        "duration-150",
        // Единый hover рядов списков (см. CDM_LIST_ITEM_HOVER в constants.ts)
        "hover:bg-[var(--second-bg)]",
        "active:bg-[var(--second-bg)]",
        "rounded-md",
        "cursor-pointer"
    );

    // Метка, по которой пресет поповера узнаёт «пункт меню» и закрывает окно
    itemElement.setAttribute("data-popover-item", "");

    if (item.iconName) {
        // `Icons.icon` возвращает null для неизвестной иконки —
        // пункт добавляется без неё
        const icon = Icons.icon(item.iconName);
        if (icon) itemElement.append(icon);
    }

    if (item.cssClasses) {
        item.cssClasses.forEach(cl => itemElement.classList.add(cl));
    }

    const textSpan = document.createElement("span");
    textSpan.classList.add("text");
    textSpan.textContent = item.text;
    itemElement.appendChild(textSpan);

    // Текущий выбор: подсветка строки и галочка справа
    if (item.isActive) {
        itemElement.classList.add("text-[var(--color-brand)]", "font-semibold");
        const check = Icons.icon("check", { classes: ["stroke-brand-600", "dark:stroke-brand-500"] });
        if (check) {
            check.classList.add("ml-auto", "shrink-0");
            itemElement.append(check);
        }
    }

    // Закрывает поповер не обработчик, а пресет: он слушает клики по контенту
    // целиком. Здесь только действие пункта.
    const onClick = item.onClick;
    if (typeof onClick === "function") {
        itemElement.addEventListener("click", (e) => onClick(e, item));
    }

    return itemElement;

}