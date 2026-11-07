// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение размера текста сообщений: запись коэффициента в сессию и
 * применение CSS-переменной на лету.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function messageTextSizeHandler(form: UserSettingDecorations): Promise<void> {

    // Размер текста сообщений: выбранная карточка радиогруппы
    const messageTextSize = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="message-text-size"]:checked`);

    try {

        // Значение карточки — готовый множитель от 16px ("1" = 16px)
        const size = Number(messageTextSize?.value) || 1;

        // Обновляем данные в сессии
        const session = LocalStorage.session;

        // NOTE(MIGRATION): поле объявлено строкой-коэффициентом (см.
        // SessionDecorationsSettings) — храним строку; читатели умножают или
        // интерполируют значение, поведение идентично легаси-числу
        if (session) {
            session.settings.user.decorations.message_text_size = String(size);
            LocalStorage.updateSession(session);
        }

        // Получаем значение рут переменной
        const root = document.documentElement;

        // Устанавливаем размер текста сообщения
        root.style.setProperty("--message-text-size", `${size}rem`);

    } catch (error) {
        Logger.error(error);
    }

}
