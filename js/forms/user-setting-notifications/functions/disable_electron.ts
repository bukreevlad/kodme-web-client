// Импортируем utils
import { ElectronNotifications } from "../../../utils/electron_notifications.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем типы
import type { UserSettingNotifications } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Отключение уведомлений в десктоп-обёртке Electron: выбор хранится
 * в LocalStorage и применяется клиентом при работающем приложении.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function disableElectron(form: UserSettingNotifications): Promise<void> {

    // Отключаем уведомления
    ElectronNotifications.setEnabled(false);

    // Toast
    Toast.success(t("forms.user_setting_notifications.toasts.electron_disabled"));

    // Закрываем форму
    form.modal?.close();

}
