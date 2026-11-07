// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем forms
import { BroadcastSettings } from "../../broadcast-settings/index.js";

// Импортируем handlers
import { sourceHandler } from "./source.js";

// Импортируем типы
import type { SessionProfile } from "../../menu/types.js";
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * Контекстное меню трансляции (кнопка «...» в шапке).
 *
 * Пункт «Источник видео» показывается только при живом потоке, пункт
 * «Настройки» — только автору трансляции (или автору бота-ведущего).
 * Пустое меню не открывается: раньше оно рисовало пустой поповер.
 * @param event - Событие клика по кнопке меню.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function menuHandler(event: Event, form: BroadcastPlay): Promise<void> {

    try {

        // Определение списка элементов меню
        const menuItems = [];

        // menu item — выбор источника воспроизведения.
        //
        // Протоколы (RTC / FLV / HLS) здесь не перечисляются по отдельности:
        // один набор живёт в поповере handlers/source.ts, и единственный
        // вход в него — этот пункт меню. Раньше вторым входом служила
        // плашка поверх видео, но она перекрывала кадр и убрана
        if (form.cast?.stream?.online) {
            menuItems.push({
                text: window._lc.forms.broadcast_play.context_menu.source,
                iconName: "antenna-bars-5",
                onClick: () => sourceHandler(form, form.menuButton)
            });
        }

        // menu item
        const settings = {
            text: window._lc.forms.broadcast_play.context_menu.settings,
            iconName: "Settings",
            onClick: () => new BroadcastSettings({ castId: form.castId })
        };

        // Сессия пользователя (user хранится как unknown на границе
        // localStorage — invariant: меню читает из него id профиля,
        // канон — menu/handlers/profile.ts)
        const sessionUser = LocalStorage.session?.user as SessionProfile;

        // settings — только создатель трансляции. Владелец бота-создателя
        // сюда не попадает: трансляциями бота управляет только бот
        if (form.cast?.created_user_id === sessionUser.id) {
            menuItems.push(settings);
        }

        // Пустое меню открывать нечего: раньше оно рисовало пустой поповер,
        // и пользователь видел бежащую плашку без единого пункта
        if (!menuItems.length) return;

        // Отменяем стандартное контекстное меню браузера
        event.preventDefault();

        // Создание и открытие контекстного меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            targetNode: form.menuButton,
            targetNodeDirection: "bottom"
        });

        // Открываем меню
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
