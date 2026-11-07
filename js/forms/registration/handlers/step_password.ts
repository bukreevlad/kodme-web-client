// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";
import { Inputs } from "../../../components/inputs.js";

// Импортируем типы
import type { Registration } from "../index.js";

/**
 * ***************************************************************************
 * Второй шаг регистрации: проверка имени и фамилии, переход к паролю.
 * @param form - Форма регистрации.
 * ***************************************************************************
 */
export function stepPasswordHandler(form: Registration): void {

    try {

        // Без шаблона шаг заполнять нечего
        const tpl = form.tpl;
        if (!tpl) return;

        // Имя
        const firstName = tpl.querySelector<HTMLInputElement>(`[name="first-name"]`);
        const lastName = tpl.querySelector<HTMLInputElement>(`[name="last-name"]`);

        // Поля обязаны входить в шаблон — иначе заполнять и подсвечивать нечего
        if (!firstName || !lastName) return;

        // Записываем значение на форму
        form.firstName = firstName.value.trim();
        form.lastName = lastName.value.trim();

        // Если имя пустое
        if (!form.firstName) {
            Inputs.markInvalid(firstName, true);
            Toast.error(window._lc.forms.registration.toasts.not_first_name);
            return;
        }

        // Если имя некорректное (2-64 символа, только буквы) — предупреждение
        if (!/^[а-яёa-z]{2,64}$/i.test(form.firstName)) {
            Inputs.markInvalid(firstName, true);
            Toast.warning(window._lc.forms.registration.toasts.invalid_first_name);
            return;
        }

        // Если фамилия пустая
        if (!form.lastName) {
            Inputs.markInvalid(lastName, true);
            Toast.error(window._lc.forms.registration.toasts.not_last_name);
            return;
        }

        // Если фамилия некорректная (2-64 символа, только буквы) — предупреждение
        if (!/^[а-яёa-z]{2,64}$/i.test(form.lastName)) {
            Inputs.markInvalid(lastName, true);
            Toast.warning(window._lc.forms.registration.toasts.invalid_last_name);
            return;
        }

        // Убираем подсветку ошибки
        Inputs.markInvalid(firstName, false);
        Inputs.markInvalid(lastName, false);

        // Переключаем таб (табы собираются в _setup до вешания handlers)
        form.tabs?.activateTab("password");

    } catch (error) {
        Logger.error(error);
    }

}
