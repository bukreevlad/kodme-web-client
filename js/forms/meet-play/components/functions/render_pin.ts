// Импортируем utils
import { Icons } from "../../../../utils/icons.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * renderPin - Показывает или прячет значок закрепления на плитке.
 *
 * Без значка закрепление выглядит сломанным: режим по умолчанию —
 * `grid`, где крупной плитки нет вообще, и нажатие «Сделать главным»
 * не изменило бы ничего. Значок в подписи имени (а не обводка плитки)
 * выбран по двум причинам: обводка уже занята индикатором говорящего и
 * в том же токене темы, а углы плитки заняты значком руки и бейджами
 * запретов (см. отклонение 18).
 *
 * Значок принадлежит подписи, поэтому он виден во всех режимах сетки и
 * не перекрывает видео.
 * @param tile - Корневой элемент плитки участника.
 * @param isPinned - Закреплена ли эта плитка (по умолчанию false).
 * @returns {void}
 * ***************************************************************************
 */
export function renderPin(tile: HTMLElement | null | undefined, isPinned = false): void {

    const element = tile?.querySelector<HTMLElement>(":scope [data-pin]");
    if (!element) return;

    // ---------- СОСТОЯНИЕ ----------
    const pinned = Boolean(isPinned);

    // ---------- ИКОНКА ----------
    // Рисуем один раз: значок ставится и снимается по клику в меню, а
    // пересобирать DOM на каждое перестроение сетки незачем. Icons.icon
    // возвращает null на неизвестном имени — результат проверяем, иначе
    // appendChild бросил бы исключение
    if (pinned && !element.childElementCount) {
        const icon = Icons.icon("pinned", { settings: { size: 14 } });
        if (icon) element.appendChild(icon);
    } else if (!pinned && element.childElementCount) {
        element.replaceChildren();
    }

    // ---------- ВИДИМОСТЬ ----------
    // Парой `hidden`/`flex`, а не одним `hidden` поверх статичного
    // `flex`: display-утилиты в собранном CSS идут по алфавиту и `flex`
    // перебил бы `hidden`
    element.classList.toggle("hidden", !pinned);
    element.classList.toggle("flex", pinned);

    // ---------- ДОСТУПНОСТЬ ----------
    // Роль `img` обязательна: на голом `span` с одной подписью
    // скринридер промолчит. Подпись — из меню, отдельного ключа ради
    // одного слова не заводим
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", pinned ? t("forms.meet_play.context_menu.make_main") : "");

}
