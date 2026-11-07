// Импортируем utils
import { ElectronNotifications } from "../../../utils/electron_notifications.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем типы
import type { UserSettingNotifications } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Включение уведомлений в десктоп-обёртке Electron: Web Push в Electron
 * не работает (нет push-сервиса), поэтому выбор хранится в LocalStorage
 * и применяется клиентом при работающем приложении.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function enableElectron(form: UserSettingNotifications): Promise<void> {

    // Включаем уведомления
    ElectronNotifications.setEnabled(true);

    // Toast
    Toast.success(t("forms.user_setting_notifications.toasts.electron_enabled"));

    // Закрываем форму
    form.modal?.close();

}
