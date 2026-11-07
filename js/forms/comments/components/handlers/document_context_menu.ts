// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { readEventPoint } from "../../../../utils/dom/read_event_point.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../../components/overlay/popover_menu.js";
import type { AttachContextMenuHost } from "../types.js";

/**
 * ***************************************************************************
 * documentContextMenuHandler - контекстное меню строки документа
 * (скачивание файла).
 * @param event - Событие (мышь или тач).
 * @param host - Хост с действием скачивания.
 * ***************************************************************************
 */
export async function documentContextMenuHandler(event: Event, host: AttachContextMenuHost): Promise<void> {

    try {

        // Получение координат из события: в MouseEvent они в clientX/clientY,
        // а в touch-событиях — в changedTouches
        const point = readEventPoint(event);
        const x = point?.x ?? 0;
        const y = point?.y ?? 0;

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // ================================

        // menu item
        const download = {
            text: window._lc.forms.comments.components.document_item.context_menu.download,
            iconName: "Download",
            onClick: async () => await host.initDownload?.()
        };
        menuItems.push(download);

        // ================================

        // Открываем меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            x: x,
            y: y
        });

        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
