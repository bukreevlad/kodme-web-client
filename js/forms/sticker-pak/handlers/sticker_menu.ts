// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем dialogs
import { ConfirmStickerDialog } from "../dialogs/confirm/index.js";

// Импортируем functions
import { removeSticker } from "../functions/remove_sticker.js";

// Импортируем requests
import { deleteStickerRequest } from "../requests/delete_sticker.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";
import type { StickerItem } from "../types.js";
import type { StickerPak } from "../index.js";

/**
 * ***************************************************************************
 * Контекстное меню стикера (только для автора пака).
 *
 * Единственный пункт — «Удалить» с подтверждением: стикер отвязывается
 * от пака, его плашка в списке обновляется (количество и превью).
 * @param x - Координата X точки открытия меню.
 * @param y - Координата Y точки открытия меню.
 * @param form - Экземпляр формы.
 * @param sticker - Стикер, для которого открыто меню.
 * ***************************************************************************
 */
export function stickerContextMenuHandler(x: number, y: number, form: StickerPak, sticker: StickerItem): void {

    try {

        // Меню доступно только автору пака
        if (!form.pak?.is_author) return;

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // menu item
        const remove: PopoverMenuItem = {
            text: window._lc.forms.sticker_pak.menu.delete,
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => confirmDeleteSticker(form, sticker)
        };
        menuItems.push(remove);

        // Открываем меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            x: x,
            y: y
        });

        contextMenu.open();

    } catch (error) {
        Logger.error("[app][sticker-pak][sticker-menu]:", error);
    }

}

/**
 * ***************************************************************************
 * Приватная: подтверждение и удаление стикера из пака.
 * @param form - Экземпляр формы.
 * @param sticker - Удаляемый стикер.
 * ***************************************************************************
 */
function confirmDeleteSticker(form: StickerPak, sticker: StickerItem): void {

    // Подтверждение удаления
    new ConfirmStickerDialog({
        title: window._lc.forms.sticker_pak.confirm.title,
        description: window._lc.forms.sticker_pak.confirm.description,
        actionClose: window._lc.forms.sticker_pak.confirm.cancel,
        actionRemove: window._lc.forms.sticker_pak.confirm.confirm,
        callback: async (response) => {

            // Отмена — выходим
            if (!response) return;

            try {

                // Запрос удаления (сервер убирает строку-связь)
                await deleteStickerRequest({
                    pak_id: form.pakId,
                    sticker_id: sticker.sticker_id
                });

                // Убираем стикер из сетки и обновляем плашку пака в списке
                removeSticker(form, sticker.sticker_id);

            } catch (error) {

                // Показываем тост (коды ошибок разбирает сам toastError)
                toastError(error, {
                    context: "[app][sticker-pak][delete-sticker]",
                    fallback: window._lc.forms.sticker_pak.toasts.delete_error
                });

            }

        }
    });

}
