// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем forms
import { StickerPakEdit } from "../../sticker-pak-edit/index.js";

// Импортируем dialogs
import { ConfirmStickerPakDialog } from "../dialogs/confirm/index.js";

// Импортируем requests
import { deletePakRequest } from "../requests/delete_pak.js";
import { subscribeRequest } from "../requests/subscribe.js";
import { unsubscribeRequest } from "../requests/unsubscribe.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";
import type { StickerPakItem } from "../types.js";
import type { StickerPaks } from "../index.js";

/**
 * ***************************************************************************
 * Контекстное меню плашки пака.
 *
 * Пункты набираются по состоянию пака:
 * - автору доступны «Редактировать» и «Удалить» (с подтверждением);
 * - чужой публичный пак: «Добавить к себе» / «Убрать из добавленных».
 * @param x - Координата X точки открытия меню.
 * @param y - Координата Y точки открытия меню.
 * @param form - Экземпляр формы списка.
 * @param data - Пак, для которого открыто меню.
 * ***************************************************************************
 */
export function packContextMenuHandler(x: number, y: number, form: StickerPaks, data: StickerPakItem): void {

    try {

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // ================================

        // menu item
        const edit: PopoverMenuItem = {
            text: window._lc.forms.sticker_paks.menu.edit,
            iconName: "pencil-minus",
            onClick: () => new StickerPakEdit({ pakId: data.id })
        };
        if (data.is_author) {
            menuItems.push(edit);
        }

        // ================================

        // menu item
        const remove: PopoverMenuItem = {
            text: window._lc.forms.sticker_paks.menu.delete,
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => confirmDeletePak(form, data)
        };
        if (data.is_author) {
            menuItems.push(remove);
        }

        // ================================

        // menu item
        const subscribe: PopoverMenuItem = {
            text: window._lc.forms.sticker_paks.menu.add,
            iconName: "Plus",
            onClick: () => subscribePak(form, data)
        };
        if (!data.is_author && data.is_public && !data.is_member) {
            menuItems.push(subscribe);
        }

        // ================================

        // menu item
        const unsubscribe: PopoverMenuItem = {
            text: window._lc.forms.sticker_paks.menu.remove,
            iconName: "Minus",
            onClick: () => unsubscribePak(form, data)
        };
        if (!data.is_author && data.is_public && data.is_member) {
            menuItems.push(unsubscribe);
        }

        // ================================

        // Нечего показывать — не открываем пустое меню
        if (!menuItems.length) return;

        // Открываем меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            x: x,
            y: y
        });

        contextMenu.open();

    } catch (error) {
        Logger.error("[app][sticker-paks][context-menu]:", error);
    }

}

/**
 * ***************************************************************************
 * Приватная: подтверждение и удаление пака.
 *
 * После успеха пак убирается из стора списка — строка исчезает из UI.
 * @param form - Экземпляр формы списка.
 * @param data - Удаляемый пак.
 * ***************************************************************************
 */
function confirmDeletePak(form: StickerPaks, data: StickerPakItem): void {

    // Подтверждение удаления
    new ConfirmStickerPakDialog({
        title: window._lc.forms.sticker_paks.confirm.title,
        description: window._lc.forms.sticker_paks.confirm.description,
        actionClose: window._lc.forms.sticker_paks.confirm.cancel,
        actionRemove: window._lc.forms.sticker_paks.confirm.confirm,
        callback: async (response) => {

            // Отмена — выходим
            if (!response) return;

            try {

                // Запрос удаления
                await deletePakRequest({ pak_id: data.id });

                // Убираем пак из стора — строка пропадает из списка
                form.store.remove(data.id);

            } catch (error) {

                // Показываем тост (коды ошибок разбирает сам toastError)
                toastError(error, {
                    context: "[app][sticker-paks][delete-pak]",
                    fallback: window._lc.forms.sticker_paks.toasts.delete_error
                });

            }

        }
    });

}

/**
 * ***************************************************************************
 * Приватная: подписка на пак («добавить к себе»).
 *
 * Флаг is_member обновляется в сторе — метка «Добавлен» появляется
 * на плашке без перезагрузки списка.
 * @param form - Экземпляр формы списка.
 * @param data - Пак, на который подписываемся.
 * ***************************************************************************
 */
async function subscribePak(form: StickerPaks, data: StickerPakItem): Promise<void> {

    try {

        // Запрос подписки
        await subscribeRequest({ pak_id: data.id });

        // Обновляем флаг в сторе (item::updated перерисует плашку)
        form.store.update(data.id, { ...data, is_member: true });

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][sticker-paks][subscribe]",
            fallback: window._lc.forms.sticker_paks.toasts.subscribe_error
        });

    }

}

/**
 * ***************************************************************************
 * Приватная: отписка от пака («убрать из добавленных»).
 *
 * Пак остаётся в каталоге — пропадает только пометка «Добавлен».
 * @param form - Экземпляр формы списка.
 * @param data - Пак, от которого отписываемся.
 * ***************************************************************************
 */
async function unsubscribePak(form: StickerPaks, data: StickerPakItem): Promise<void> {

    try {

        // Запрос отписки
        await unsubscribeRequest({ pak_id: data.id });

        // Обновляем флаг в сторе (item::updated перерисует плашку)
        form.store.update(data.id, { ...data, is_member: false });

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][sticker-paks][unsubscribe]",
            fallback: window._lc.forms.sticker_paks.toasts.unsubscribe_error
        });

    }

}
