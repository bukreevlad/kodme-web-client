// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";
import type { ChatBackgroundData } from "../types.js";

/**
 * ***************************************************************************
 * Сохранение выбранного фона чатов: запись пути в сессию, смена SVG-фона у
 * всех открытых форм сообщений и синхронизация активной обводки.
 * @param form - Экземпляр формы.
 * @param data - Данные фона.
 * ***************************************************************************
 */
export async function saveChatBackgroundPatternHandler(form: UserSettingDecorations, data: ChatBackgroundData): Promise<void> {

    try {

        // Обновляем данные в сессии (без неё обновлять нечего)
        const session = LocalStorage.session;
        if (!session) return;

        // NOTE(MIGRATION): убран всегда-истинный fallback-путь — шаблонная
        // строка с data.id никогда не пуста, ветка || не отрабатывала
        session.settings.user.decorations.chat_background.src = `img/svg-backgrounds/${data.id}`;
        LocalStorage.updateSession(session);

        // Получаем все открытые формы Messages
        const MessagesInstances = Array.from(Messages.instances.values());

        // Проходим по формам и меняем фон (без менеджера фон не меняем)
        MessagesInstances.forEach(instance => {
            instance.svgMaskManager?.updateSVGUrl(`img/svg-backgrounds/${data.id}`);
        });

        // Синхронизируем UI: подсвечиваем обводкой выбранный фон
        const tpl = form.tpl;
        if (!tpl) return;

        const currentSrc = session.settings.user.decorations.chat_background.src;
        const backgroundItems = tpl.querySelectorAll<HTMLElement>(`:scope >.content [data-list-chat-backgrounds] .item`);
        backgroundItems.forEach(item => {
            const itemId = item.getAttribute("data-background-id");
            const isActive = itemId != null && `img/svg-backgrounds/${itemId}` === currentSrc;
            item.classList.toggle("ring-[var(--color-brand)]", isActive);
        });

    } catch (error) {
        Logger.error(error);
    }

}
