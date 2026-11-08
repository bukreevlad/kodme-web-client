// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";
import { Buttons } from "../../../components/buttons.js";

// Импортируем handlers
import { authSessionHandler } from "../handlers/auth_session.js";

// Импортируем типы
import type { MenuSessionItem, SessionProfile } from "../types.js";
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Строка сохранённой сессии в списке меню.
 *
 * @param form - Экземпляр формы меню.
 * @param data - Сессия из хранилища (элемент стора формы).
 * @returns Кнопка строки списка либо null, если её не удалось собрать.
 * ***************************************************************************
 */
export function createSessionItem(form: Menu, data: MenuSessionItem): HTMLElement | null {

    let button: Buttons | null = null;

    try {

        // invariant: user_data сессии приходит с сервера в фиксированном
        // виде { display_name, id, avatar, ... } (см. ответ auth/check и
        // сохранение сессии) — читаем поля этим сужением unknown
        const user = data.user as SessionProfile;

        // Аватар
        const avatar = Avatars.create({
            id: user.id,
            name: user.display_name,
            image: user.avatar,
            size: "xs"
        });

        // Кнопка строки: аватар слева, имя справа
        button = Buttons.transparent({
            classes: ["justify-start", "justify-start", "truncate"],
            text: user.display_name
        });

        button.dom.prepend(avatar?.dom);

    } catch (error) {
        Logger.error(error);
    }

    if (button) {

        // DOM-копия строки — в общий список сессии: по ней элемент списка
        // удаляется из DOM при выгрузке записи из стора (см. subscribeItemRemoved)
        if (!data.__domElements__) {
            data.__domElements__ = [];
        }
        data.__domElements__.push(button.dom);

        // Авторизация
        button.dom.addEventListener("click", () => authSessionHandler(form, data));

    }

    return button?.dom ?? null;

}
