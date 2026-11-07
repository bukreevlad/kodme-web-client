// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { PlatformBridge } from "../../../utils/platform.bridge.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { disableAndroid } from "../functions/disable_android.js";
import { disableWeb } from "../functions/disable_web.js";
import { disableElectron } from "../functions/disable_electron.js";

// Импортируем типы
import type { UserSettingNotifications } from "../index.js";

/**
 * ***************************************************************************
 * Отключение уведомлений: маршрутизирует в web-ветку (Service Worker), либо
 * в нативную Android-ветку (мост PlatformBridge), либо в локальную ветку
 * десктоп-обёртки Electron (LocalStorage).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function disableHandler(form: UserSettingNotifications): Promise<void> {

    try {

        // Если это десктоп-обёртка Electron
        if (PlatformBridge.isElectron()) {

            // Отключаем уведомления Electron
            await disableElectron(form);

            // Если это Android
        } else if (PlatformBridge.isAndroidDevice) {

            // Отключаем уведомления
            await disableAndroid(form);

        } else {

            // Отключаем web уведомления
            await disableWeb(form);

        }

    } catch (error) {
        Logger.error(error);

        // Toast
        Toast.error(getErrorMessage(error), {
            duration: 0
        });

    }

}
