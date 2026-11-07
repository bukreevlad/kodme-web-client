// Импортируем utils
import { Icons } from "../../../utils/icons.js";

/**
 * ***************************************************************************
 * setButtonIcon - замена иконки кнопки (состояние микрофона/камеры).
 * Иконка живёт на самом SVG с маркером data-button-icon (см. components).
 * @param button - Кнопка формы.
 * @param name - Имя иконки из набора Icons.
 * @returns void
 * ***************************************************************************
 */
export function setButtonIcon(button: Element | null, name: string): void {

    const oldIcon = button?.querySelector("[data-button-icon]");
    const newIcon = Icons.icon(name);
    if (!oldIcon || !newIcon) return;

    newIcon.setAttribute("data-button-icon", "");
    oldIcon.replaceWith(newIcon);

}
