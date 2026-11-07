// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем managers
import { SvgMaskManager } from "../../../core/managers/svg_mask_manager.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение флага фонов чатов: переключает SVG-фон у всех открытых форм
 * сообщений.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function isChatBackgroundsHandler(form: UserSettingDecorations): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const isChatBackgrounds = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-chat-background-enabled"]`);

    // Поле обязано входить в шаблон — иначе сохранять нечего
    if (!isChatBackgrounds) return;

    try {

        // Обновляем данные в сессии (без неё обновлять нечего)
        const session = LocalStorage.session;
        if (!session) return;

        session.settings.user.decorations.chat_background.enabled = isChatBackgrounds.checked;
        LocalStorage.updateSession(session);

        // Получаем все открытые формы Messages
        const MessagesInstances = Array.from(Messages.instances.values());

        // Проходим по формам и изменяем фон
        MessagesInstances.forEach(instance => {
            if (!isChatBackgrounds.checked) {
                instance.svgMaskManager?.destroy();
            } else {

                // Шаблон формы обязателен для установки фона
                const instanceTpl = instance.tpl;
                if (!instanceTpl) return;

                instance.svgMaskManager = new SvgMaskManager(instanceTpl, `${session.settings.user.decorations.chat_background.src}`);
                instance.svgMaskManager.init();
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
