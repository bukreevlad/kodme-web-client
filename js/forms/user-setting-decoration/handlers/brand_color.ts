// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Decorations } from "../../../utils/decorations.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";
import type { BrandColorData } from "../types.js";

/**
 * ***************************************************************************
 * Сохранение акцентного цвета: запись в сессию, применение на лету и
 * синхронизация активного кружка и поля «свой цвет».
 * @param form - Экземпляр формы.
 * @param data - Данные выбранного цвета.
 * ***************************************************************************
 */
export async function brandColorHandler(form: UserSettingDecorations, data: BrandColorData): Promise<void> {

    try {

        // Обновляем данные в сессии
        const session = LocalStorage.session;
        if (session) session.settings.user.decorations.brand_color = data.color || "";
        LocalStorage.updateSession(session);

        // Применяем цвет на лету
        Decorations.apply(session);

        // Синхронизируем UI: активное кольцо на выбранном пресете
        const currentColor = session?.settings.user.decorations.brand_color;
        const swatches = form.tpl?.querySelectorAll<HTMLElement>(`:scope >.content [data-brand-color-item]`);
        swatches?.forEach(swatch => {
            const isActive = (swatch.getAttribute("data-brand-color") || "") === currentColor;
            swatch.classList.toggle("ring-2", isActive);
            swatch.classList.toggle("ring-[var(--color-brand)]", isActive);
            swatch.classList.toggle("ring-offset-2", isActive);
        });

        // Синхронизируем поле «свой цвет»: если выбран пресет - показываем его,
        // иначе оставляем последнее значение из палитры
        const customInput = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="brand-color-custom"]`);
        if (customInput && data.color) customInput.value = data.color;

    } catch (error) {
        Logger.error(error);
    }

}
