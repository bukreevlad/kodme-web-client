// Импортируем utils
import { LayoutManager } from "../../../core/managers/layout_manager.js";
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Logger } from "../../../utils/logs/logger.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем config
import { slideInRight, slideOutRight } from "../../../config/animations.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * OPEN_CHAT_HANDLER - открытие чата трансляции.
 *
 * На десктопе чат монтируется в боковой контейнер средней колонки home:
 * трансляция плавно сжимается, чат встаёт справа на одном с ней уровне
 * (раскладку решает CSS по состоянию контейнера — см. css/forms/home.css,
 * раздел «Сплит-режим»). На мобильных и в узком окне чат открывается
 * обычной формой поверх.
 * @param form - Экземпляр формы трансляции.
 * ***************************************************************************
 */
export function openChatHandler(form: BroadcastPlay): void {

    try {

        // Без id канала чата открывать нечего
        const channelId = form.cast?.chat_channel_id;
        if (!channelId) return;

        // Чат уже открыт — просто активируем форму
        const instance = FormsRegistry.getOwner<Messages>(`messages:${channelId}`);
        if (instance) {
            instance.modal?.activate();
            return;
        }

        // Боковой контейнер средней колонки home
        const side = document.querySelector<HTMLElement>(".cdm-form.home .middle >.form-container-side");

        // На мобильных пресет формы сам подменяет вставку — открываем без
        // опций, чтобы чат оказался обычной формой поверх
        if (IsMobile.get() || !side) {
            new Messages({ channelId });
            return;
        }

        // Десктоп: чат — панель рабочего места трансляции в боковом
        // контейнере: видна вместе с трансляцией, закрывается с ней (parent),
        // своей пиули не имеет
        const workspaceId = form.modal?.options.id;
        if (!workspaceId) {
            new Messages({ channelId });
            return;
        }
        LayoutManager.setPane(workspaceId, "chat", side);
        new Messages({
            channelId,
            options: {
                insertInto: side,
                placement: "pane",
                workspace: workspaceId,
                parent: workspaceId,
                openAnimationClass: slideInRight,
                closeAnimationClass: slideOutRight
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
