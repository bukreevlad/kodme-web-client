// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";

// Импортируем forms
import { MeetSettings } from "../../meet-settings/index.js";
import { Broadcasts } from "../../broadcasts/index.js";

// Импортируем формы настроек конференции
import { MeetScreenSettings } from "../../meet-screen-settings/index.js";
import { MeetGridSettings } from "../../meet-grid-settings/index.js";
import { MeetDeviceSettings } from "../../meet-device-settings/index.js";

// Импортируем functions
import { toggleImmersive } from "../functions/toggle_immersive.js";

// Импортируем handlers
import { addCastToMeetHandler } from "../handlers/add_cast_to_meet.js";
import { muteAllParticipantsHandler } from "./mute_all_participants.js";

// Импортируем типы
import { BLOCK_FLAGS } from "../functions/parse_room_state.js";
import type { MeetPlay } from "../index.js";
import type { MeetBlockFlag, MeetTriggerEvent } from "../types.js";
import { I18n, t } from "../../../utils/i18n/index.js";

/**
 * Тип ключей локализации массовых действий: каждый флаг блокировки
 * отдаёт свой ключ в `forms.meet_play.context_menu`.
 */
type MassBlockLocaleKey = "mute_all_audio" | "mute_all_video" | "mute_all_screen"
    | "unmute_all_audio" | "unmute_all_video" | "unmute_all_screen";

/**
 * Массовые действия с блокировкой источников у всех участников. Ключ —
 * флаг блокировки, значение — ключи локализации и иконки.
 *
 * Пункты «разрешить» показываются только когда у кого-то в комнате
 * источник действительно заблокирован — иначе меню выглядит засорённым
 * неактивными действиями.
 *
 * Здесь намеренно лежат КЛЮЧИ локализации, а не готовые строки: текст
 * резолвится через `t()` в момент вызова, когда локализация уже
 * инициализирована.
 */
const MASS_BLOCK_ACTIONS: Record<MeetBlockFlag, {
    blockKey: MassBlockLocaleKey;
    unblockKey: MassBlockLocaleKey;
    blockIcon: string;
    unblockIcon: string;
}> = {

    audio: {
        blockKey: "mute_all_audio",
        unblockKey: "unmute_all_audio",
        blockIcon: "microphone-off",
        unblockIcon: "microphone"
    },
    video: {
        blockKey: "mute_all_video",
        unblockKey: "unmute_all_video",
        blockIcon: "video-off",
        unblockIcon: "video"
    },
    screen: {
        blockKey: "mute_all_screen",
        unblockKey: "unmute_all_screen",
        blockIcon: "screen-share-off",
        unblockIcon: "screen-share"
    }

};

/**
 * ***************************************************************************
 * Открывает контекстное меню конференции в точке клика.
 * @param event - Событие с координатами (клик, тап или вызов с клавиатуры).
 * @param form - Экземпляр формы.
 * @returns Промис открытия меню.
 * ***************************************************************************
 */
export async function menuHandler(event: MeetTriggerEvent, form: MeetPlay): Promise<void> {

    try {

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // menu item
        const screenSettings = {
            text: t("forms.meet_play.context_menu.screen_settings"),
            iconName: "heart-rate-monitor",
            onClick: () => new MeetScreenSettings({ meetId: form.meetId })
        };

        // menu item
        // Режим сетки выбирает любой участник для себя; создатель
        // конференции дополнительно может навязать его всем
        const gridSettings = {
            text: t("forms.meet_play.context_menu.grid_settings"),
            iconName: "layout-grid",
            onClick: () => new MeetGridSettings({ meetId: form.meetId })
        };

        // menu item
        // Камера и микрофон. Пункт у всех, а не только у создателя:
        // это личная настройка, и она нужна каждому, у кого в комнате
        // звук идёт не с того устройства
        const deviceSettings = {
            text: t("forms.meet_play.context_menu.device_settings"),
            iconName: "devices",
            onClick: () => new MeetDeviceSettings({ meetId: form.meetId })
        };

        // menu item
        const settings = {
            text: t("forms.meet_play.context_menu.settings"),
            iconName: "Settings",
            onClick: () => new MeetSettings({ meetId: form.meetId })
        };

        // menu item
        const addStream = {
            text: t("forms.meet_play.context_menu.add_cast"),
            iconName: "brand-parsinta",
            onClick: () => new Broadcasts({
                callback: (cast: { id: string } | null) => {
                    if (cast) { addCastToMeetHandler(form, cast); }
                }
            })
        };

        // menu item
        // Immersive-режим. Подпись читается на момент открытия меню,
        // а не задаётся заранее: в immersive шапка скрыта, и вернуть
        // панели можно только по Escape — но если пользователь и сам
        // открыл меню до ухода в immersive, он увидит «Показать панели»
        const immersive = {
            text: form.isImmersive
                ? t("forms.meet_play.context_menu.show_panels")
                : t("forms.meet_play.context_menu.hide_panels"),
            iconName: form.isImmersive ? "picture-in-picture-bottom" : "picture-in-picture-top",
            onClick: () => toggleImmersive(form)
        };

        // Проверяем на отображение
        menuItems.push(gridSettings, screenSettings, deviceSettings, immersive);

        // ---------- МОДЕРАЦИЯ ----------
        // Массовые блокировки доступны только создателю конференции.
        // Организатора сервер исключает из списка сам.
        if (form.isCreator) {

            const contextLocales = I18n.tree.forms.meet_play.context_menu;

            for (const flag of BLOCK_FLAGS) {

                const action = MASS_BLOCK_ACTIONS[flag];

                // Есть ли что разрешать: действует правило комнаты
                // (defaultBlocks) либо точечный запрет участника (blocks)
                const isBlockedSomewhere = [form.defaultBlocks, ...Object.values(form.blocks)]
                    .some(blocks => blocks?.[flag] === true);

                // «Разрешить всем» имеет смысл только если есть что разрешать
                if (isBlockedSomewhere) {
                    menuItems.push({
                        text: contextLocales[action.unblockKey],
                        iconName: action.unblockIcon,
                        onClick: () => muteAllParticipantsHandler(form, flag, false)
                    });
                    continue;
                }

                // Пункт доступен, даже когда в комнате никого нет: запрет
                // пишется в правило комнаты и действует до первого участника
                menuItems.push({
                    text: contextLocales[action.blockKey],
                    iconName: action.blockIcon,
                    onClick: () => muteAllParticipantsHandler(form, flag, true)
                });

            }

            menuItems.push({ text: "", isSeparator: true }); // text обязателен типом пункта, при isSeparator не читается

        }
        // ---------- МОДЕРАЦИЯ ----------

        // Если это создатель конференции — показываем настройки конференции
        // и возможность добавить трансляцию
        if (form.isCreator) {
            menuItems.push(settings, addStream);
        }

        // Получение координат из события
        const x = event?.clientX || event?.changedTouches?.[0]?.clientX || 0;
        const y = event?.clientY || event?.changedTouches?.[0]?.clientY || 0;

        // Отменяем стандартное контекстное меню браузера
        event.preventDefault?.();

        // Создание и открытие контекстного меню в точке клика
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            targetNode: form.tpl?.querySelector(":scope >.header [action-menu]") ?? null,
            targetNodeDirection: "bottom",
            x,
            y
        });

        // Открываем меню
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
