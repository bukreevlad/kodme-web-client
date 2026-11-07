// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";
import { Inputs } from "../../../components/inputs.js";

// Импортируем типы
import type { Registration } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Первый шаг регистрации: проверка email и переход к именам.
 * @param form - Форма регистрации.
 * ***************************************************************************
 */
export function stepNamesHandler(form: Registration): void {

    try {

        // Email
        const email = form.tpl?.querySelector<HTMLInputElement>(`[name="email"]`);

        // Записываем значение на форму (нет поля ввода ⇒ null — проверка пустого email сработает)
        form.email = email?.value.trim().toLowerCase() ?? null;

        // Если email пустой
        if (!form.email) {
            Inputs.markInvalid(email, true);
            Toast.error(t("forms.registration.toasts.not_email"));
            return;
        }

        // Если email некорректный (предупреждение)
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            Inputs.markInvalid(email, true);
            Toast.warning(t("forms.registration.toasts.invalid_email"));
            return;
        }

        // Убираем подсветку ошибки
        Inputs.markInvalid(email, false);

        // Переключаем таб
        form.tabs?.activateTab("names");

    } catch (error) {
        Logger.error(error);
    }

}
