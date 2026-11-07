// Импортируем типы
import type { UserSettingSecurity } from "../index.js";
import type { TotpStatusData } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Обновление карточки TOTP по статусу: текст состояния и видимость кнопок
 * «Включить»/«Отключить».
 * Видимость переключается только классом hidden (его приоритет выше
 * display-утилит).
 * @param form - Форма безопасности.
 * @param status - Статус TOTP.
 * ***************************************************************************
 */
export function updateTotpCard(form: UserSettingSecurity, status: TotpStatusData): void {

    // Запоминаем статус в форме (нужен при повторных перерисовках)
    form.totpStatus = status;

    // Текст состояния: включён / незавершённая настройка / выключен
    if (form.totpStatusEl) {
        if (status.enabled) {
            form.totpStatusEl.textContent = t("forms.user_setting_security.totp_desc_on");
        } else if (status.setup_pending) {
            form.totpStatusEl.textContent = t("forms.user_setting_security.totp_desc_pending");
        } else {
            form.totpStatusEl.textContent = t("forms.user_setting_security.totp_desc_off");
        }
    }

    // Кнопка «Включить» видна, пока TOTP не подтверждён
    form.totpEnableBtn?.classList.toggle("hidden", status.enabled);

    // Кнопка «Отключить» видна только при подтверждённом TOTP
    form.totpDisableBtn?.classList.toggle("hidden", !status.enabled);

    // Если TOTP запрещён на сервере — прячем карточку целиком
    form.totpCard?.classList.toggle("hidden", !status.available);

}
