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
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Контекстное меню трансляции (кнопка «...» в шапке).
 *
 * Пункт «Источник видео» показывается только при живом потоке, пункт
 * «Настройки» — только автору трансляции (или автору бота-ведущего).
 * Пустое меню не открывается.
 * @param event - Событие клика по кнопке меню.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function menuHandler(event: Event, form: BroadcastPlay): Promise<void> {

    try {

        // Определение списка элементов меню
        const menuItems = [];

        // menu item — выбор источника воспроизведения. Протоколы
        // (RTC / FLV / HLS) здесь не перечисляем: набор живёт в
        // handlers/source.ts, вход в него только этот пункт меню
        if (form.cast?.stream?.online) {
            menuItems.push({
                text: t("forms.broadcast_play.context_menu.source"),
                iconName: "antenna-bars-5",
                onClick: () => sourceHandler(form, form.menuButton)
            });
        }

        // menu item
        const settings = {
            text: t("forms.broadcast_play.context_menu.settings"),
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

        // Пустое меню открывать нечего: поповер без пунктов — пустая плашка
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
