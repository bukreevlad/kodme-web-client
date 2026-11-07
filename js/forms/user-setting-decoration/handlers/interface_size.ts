// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение размера интерфейса: запись коэффициента в сессию и применение
 * CSS-переменной на лету.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function interfaceSizeHandler(form: UserSettingDecorations): Promise<void> {

    // Размер интерфейса: выбранная карточка радиогруппы
    const interfaceSize = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="interface-size"]:checked`);

    try {

        // Значение карточки — готовый множитель от 16px ("0.875" = 14px)
        const scale = Number(interfaceSize?.value) || 0.875;

        // Обновляем данные в сессии
        const session = LocalStorage.session;

        // NOTE(MIGRATION): поле объявлено строкой-коэффициентом (см.
        // SessionDecorationsSettings) — храним строку; читатели умножают или
        // интерполируют значение, поведение идентично легаси-числу
        if (session) {
            session.settings.user.decorations.interface_size = String(scale);
            LocalStorage.updateSession(session);
        }

        // Получаем значение рут переменной
        const root = document.documentElement;

        // Устанавливаем размер интерфейса
        root.style.setProperty("--interface-size", `${scale}rem`);

    } catch (error) {
        Logger.error(error);
    }

}
