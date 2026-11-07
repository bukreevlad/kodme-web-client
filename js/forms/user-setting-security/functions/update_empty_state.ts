// Импортируем типы
import type { UserSettingSecurity } from "../index.js";

/**
 * ***************************************************************************
 * Переключение заглушки «Ключи доступа не зарегистрированы»: показывается,
 * когда список ключей пуст.
 * @param form - Форма безопасности.
 * ***************************************************************************
 */
export function updatePasskeysEmptyState(form: UserSettingSecurity): void {

    // Определяем пустоту по DOM-списку ключей
    const isEmpty = form.passkeyList?.children.length === 0;

    // Переключаем заглушку (span без display-утилит — одной пары достаточно)
    form.passkeysEmpty?.classList.toggle("hidden", !isEmpty);

}
