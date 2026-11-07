// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем handlers
import { addCommandHandler } from "./add_command.js";
import { addCategoryHandler } from "./add_category.js";
import { importJsonHandler } from "./import_json.js";

// Импортируем dialogs
import { ExportBotCommands } from "../dialogs/export_json/index.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";
import type { BotSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Контекстное меню раздела «Меню бота»: добавление команды/папки, экспорт
 * и импорт меню в JSON.
 *
 * Легаси-пункт «Удалить меню» вызывал необъявленный класс CastsSettings
 * и падал ReferenceError по клику (пункт удалён — см. отчёт).
 *
 * @param event - Click event по кнопке контекстного меню.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function contextMenuHandler(event: Event, form: BotSettings): void {

    try {

        // Пункты меню
        const menuItems: PopoverMenuItem[] = [

            // Новая команда
            {
                text: t("forms.bot_settings.context_menu.add_command"),
                iconName: "Code",
                onClick: () => addCommandHandler(form)
            },

            // Новая папка
            {
                text: t("forms.bot_settings.context_menu.add_category"),
                iconName: "Folder",
                onClick: () => addCategoryHandler(form)
            },

            // Экспорт в JSON
            {
                text: t("forms.bot_settings.context_menu.export_to_json"),
                iconName: "Upload",
                onClick: () => {
                    // Ссылка в замыкании читается в момент клика
                    const profile = form.profile;
                    if (profile) new ExportBotCommands({
                        botId: form.botId,
                        commands: profile.bot_commands
                    });
                }
            },

            // Импорт из JSON
            {
                text: t("forms.bot_settings.context_menu.import_from_json"),
                iconName: "Download",
                onClick: () => importJsonHandler(form)
            }

        ];

        // Отменяем стандартное контекстное меню браузера
        event.preventDefault();

        // Создание и открытие контекстного меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            targetNode: form.tpl?.querySelector(":scope >.content [action-context-menu]") ?? null,
            targetNodeDirection: "bottom"
        });

        // Открываем меню
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
