// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { readEventPoint } from "../../../../utils/dom/read_event_point.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем functions
import { goToMessage } from "../../functions/go_to_message.js";
import { getSectionMessageId } from "../../functions/get_message_id.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../../components/overlay/popover_menu.js";
import type { ChannelProfile, ChannelSectionItemData } from "../../types.js";
import type { SectionRowKind } from "../../functions/get_message_id.js";
import { I18n, t } from "../../../../utils/i18n/index.js";

/**
 * Типы строк секций, различающиеся пунктом «Скачать» и типом записи.
 */
export type ContextMenuType = "file" | "audio" | "audioNote" | "photo" | "video" | "url";

/**
 * Строка секции, которой нужно контекстное меню.
 *
 * Метод скачивания не обязателен: у строк голосовых файлов его нет, и
 * пункт «Скачать» в этом случае просто ничего не делает.
 * Данные и форма обязательны: из них меню строит пункт «Перейти к сообщению».
 */
export interface ContextMenuItem {

    /** Корневой DOM-элемент строки: без него меню не к чему привязать. */
    element: HTMLElement;

    /** Форма-владелец строки (нужна для перехода к сообщению). */
    form: ChannelProfile;

    /** Данные записи секции (из них берётся id сообщения-владельца). */
    data: ChannelSectionItemData;

    /**
     * Запускает скачивание файла строки (если уже идёт — не запускает новое).
     * @returns Promise, который завершится, когда загрузка завершится.
     */
    _initDownload?(): Promise<void>;

}

/**
 * ***************************************************************************
 * Ветка локали с пунктом «Скачать» для типа строки.
 */
type DownloadLocale = { download?: string } | null;

/**
 * Ветка локали сообщений (вызывается в момент вызова меню, когда локаль уже
 * загружена).
 * @returns Ветка или null/undefined, если локаль не подгрузилась.
 ***************************************************************************
 */
function getMessages() {
    return I18n.tree.forms.messages.components.messages;
}

/** Тип ветки локали сообщений. */
type MessagesLocale = ReturnType<typeof getMessages>;

/**
 * ***************************************************************************
 * CONTEXT_MENU_LOCALE - выбор ветки локали для каждого типа строки.
 *
 * Текст резолвится через `t()` в момент вызова: к моменту импорта
 * модуля локализация ещё не инициализирована.
 *
 * У медиа-плиток (фото/видео) и строк «Ссылок» пункта «Скачать» нет —
 * там ветка null, и пункт в меню не добавляется.
 * ***************************************************************************
 */
const CONTEXT_MENU_LOCALE: Record<ContextMenuType, (messages: MessagesLocale) => DownloadLocale> = {

    // Строка файла
    file: (messages) => messages?.document_item?.context_menu ?? null,

    // Строка аудио
    audio: (messages) => messages?.audio_item?.context_menu ?? null,

    // Строка голосового
    audioNote: (messages) => messages?.audio_note_item?.context_menu ?? null,

    // Медиа-плитка фото (скачивания нет — открытие в просмотрщике по тапу)
    photo: () => null,

    // Медиа-плитка видео (скачивания нет — открытие в просмотрщике по тапу)
    video: () => null,

    // Строка ссылки (скачивать нечего)
    url: () => null

};

/**
 * ***************************************************************************
 * CONTEXT_MENU_ROW_KIND - как запись типа строки связана с сообщением.
 *
 * От типа зависит, откуда берётся id сообщения для пункта «Перейти к
 * сообщению» (см. functions/get_message_id.ts).
 * ***************************************************************************
 */
const CONTEXT_MENU_ROW_KIND: Record<ContextMenuType, SectionRowKind> = {

    // Вложения: сообщение-владелец лежит в entity_context записи
    file: "attachment",
    audio: "attachment",
    audioNote: "attachment",
    photo: "attachment",
    video: "attachment",

    // «Ссылки»: строка секции — это само сообщение, его id в поле id
    url: "message"

};

/**
 * ***************************************************************************
 * Достаёт из локали ветку для типа строки.
 *
 * Если у типа нет пункта скачивания (медиа-плитки, «Ссылки») либо локаль
 * не подгрузилась — возвращается null, и пункт «Скачать» в меню не добавляется.
 * @param type - Тип строки: "file" | "audio" | "audioNote" | ... .
 * @returns Ветка локали или null.
 ***************************************************************************
 */
function getLocale(type: ContextMenuType): DownloadLocale {

    const resolve = CONTEXT_MENU_LOCALE[type];
    if (!resolve) return null;

    return resolve(getMessages());

}

/**
 * ***************************************************************************
 * Открывает контекстное меню строки секции: «Перейти к сообщению» (если
 * сообщение-владелец записи известно) и «Скачать» (у строк с загрузчиком).
 * @param event - Событие (мышь или тап: координаты читаем с учётом типа).
 * @param item - Строка секции с формой, данными и методом _initDownload.
 * @param type - Тип строки: "file" | "audio" | "audioNote" | "photo" | "video" | "url".
 * @returns Promise, завершающийся после открытия меню или ошибки в логе.
 ***************************************************************************
 */
export async function ContextMenuHandler(
    event: Event,
    item: ContextMenuItem,
    type: ContextMenuType = "file"
): Promise<void> {

    try {

        // Получение координат из события: в MouseEvent они в clientX/clientY,
        // а в touch-событиях — в changedTouches
        const point = readEventPoint(event);
        const x = point?.x ?? 0;
        const y = point?.y ?? 0;

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // ================================

        // Переход к сообщению-владельцу записи: закрывает профиль и
        // подсвечивает/подгружает сообщение в чате канала. Пункт показываем
        // только у записей, чьё сообщение известно: у вложений это
        // entity_context, у строк «Ссылок» — сам id записи
        //
        // Ссылки на форму и id берём в локальные переменные: сужение свойств
        // объекта внутри onClick колбэк не сохраняет
        const form = item.form;
        const messageId = getSectionMessageId(item.data, CONTEXT_MENU_ROW_KIND[type]);

        if (form && messageId) {
            menuItems.push({
                text: t("forms.channel_profile.context_menu.go_to_message"),
                iconName: "MessageUp",
                onClick: () => goToMessage(form, messageId)
            });
        }

        // ================================

        // menu item «Скачать»: есть только у строк, у которых есть ветка
        // локали (файлы/аудио/голосовые); у медиа-плиток и «Ссылок» его нет
        const downloadLocale = getLocale(type);

        if (downloadLocale) {
            menuItems.push({
                text: downloadLocale.download || "",
                iconName: "Download",
                onClick: async () => await item?._initDownload?.()
            });
        }

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
