// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем config
import { EMOJI } from "../../../config/emoji.js";

// Импортируем components
import { EmojiCategoryItem } from "../components/emoji.js";

// Импортируем типы
import type { Emoji } from "../index.js";

/**
 * ***************************************************************************
 * Загружает категории эмодзи из конфига в список формы.
 * @param form - Форма эмодзи.
 * ***************************************************************************
 */
export async function loadEmoji(form: Emoji): Promise<void> {

    try {

        // Проходим по emoji
        EMOJI.forEach(category => {
            const item = new EmojiCategoryItem(form, category);
            const dom = item.getDOM();
            if (dom) form.list?.append(dom);
        })

    } catch (error) {
        Logger.error(error);
    }

}
