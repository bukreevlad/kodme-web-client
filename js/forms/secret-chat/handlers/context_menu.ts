// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Toast } from "../../../components/toast.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";

// Импортируем handlers
import { removeChatHandler } from "./remove_chat.js";

// Импортируем типы
import type { SecretSelfDestructValue } from "../../../types/secret_chats.js";
import type { SecretChat } from "../index.js";
import { I18n, t } from "../../../utils/i18n/index.js";

/** Значения таймера самоуничтожения для пунктов меню (null — выключен). */
const SELF_DESTRUCT_VALUES: Array<SecretSelfDestructValue | null> = [null, "5s", "1m", "1h", "1d", "1w"];

/**
 * ***************************************************************************
 * Открыть контекстное меню секретного чата: таймер самоуничтожения и
 * удаление чата. Пункты верификации добавятся отдельной фазой.
 * @param event - Событие вызова (клик по кнопке меню).
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после открытия меню.
 * ***************************************************************************
 */
export async function contextMenuHandler(event: Event, form: SecretChat): Promise<void> {

    try {

        // Если нет формы или чат не загружен — меню построить не из чего
        if (!form) return;
        if (!form.chat) return;

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // menu item: таймер самоуничтожения (значения — вторым поповером:
        // PopoverMenuItem не поддерживает вложенные подменю)
        let selfDestruct: PopoverMenuItem = {
            text: t("forms.secret_chat.context_menu.self_destruct"),
            iconName: "clock",
            onClick: () => openSelfDestructMenu(form)
        };
        menuItems.push(selfDestruct);

        // ================================

        // menu item: удалить секретный чат (у обоих участников)
        let removeChat: PopoverMenuItem = {
            text: t("forms.secret_chat.context_menu.remove_chat"),
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeChatHandler(form)
        };
        menuItems.push(removeChat);

        // Отменяем стандартное контекстное меню браузера
        event.preventDefault();

        // Создание и открытие контекстного меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.header [action-context-menu]") ?? null,
            targetNodeDirection: "bottom"
        });

        // Открываем меню
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Подпись значения таймера самоуничтожения из локали.
 * @param value - Значение таймера (null — выключен).
 * @returns Локализованная подпись пункта меню.
 * ***************************************************************************
 */
function selfDestructLabel(value: SecretSelfDestructValue | null): string {

    const locale = I18n.tree.forms.secret_chat.context_menu;
    switch (value) {
        case "5s": return locale.self_destruct_5s;
        case "1m": return locale.self_destruct_1m;
        case "1h": return locale.self_destruct_1h;
        case "1d": return locale.self_destruct_1d;
        case "1w": return locale.self_destruct_1w;
        default: return locale.self_destruct_off;
    }

}

/**
 * ***************************************************************************
 * Открыть меню значений таймера самоуничтожения.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
function openSelfDestructMenu(form: SecretChat): void {

    // Текущее значение таймера — для отметки выбранного пункта
    const current = form.chat?.self_destruct ?? null;

    // Пункты значений таймера (текущий выбор помечен галочкой)
    const items: PopoverMenuItem[] = SELF_DESTRUCT_VALUES.map((value) => ({
        text: selfDestructLabel(value),
        isActive: value === current,
        onClick: () => setSelfDestructHandler(form, value)
    }));

    // Создание и открытие меню значений (под кнопкой меню чата)
    const menu = new Overlay(createPopoverMenu(items), {
        type: "popover",
        targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.header [action-context-menu]") ?? null,
        targetNodeDirection: "bottom"
    });

    menu.open();

}

/**
 * ***************************************************************************
 * Установить таймер самоуничтожения чата: сохранение в менеджере (запись
 * чата + сессия, отмена запущенных таймеров при выключении). Бейдж в шапке
 * и строка на главной обновляются событием chat::updated.
 * @param form - Экземпляр формы.
 * @param value - Значение таймера (null — выключен).
 * @returns Promise, завершающийся после сохранения.
 * ***************************************************************************
 */
async function setSelfDestructHandler(form: SecretChat, value: SecretSelfDestructValue | null): Promise<void> {

    try {

        // Менеджер обязан быть инициализирован (создаётся вместе с home)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Сохраняем таймер (менеджер сам обновит бейдж шапки событием)
        await manager.setSelfDestruct(form.chatId, value);

        // Сообщение
        Toast.success(t("forms.secret_chat.toasts.self_destruct_updated"), { position: "bottom-center" });

    } catch (error) {

        // Пользователь должен понимать, что произошло
        toastError(error, { context: "[app][secret-chat][self-destruct]" });

    }

}
