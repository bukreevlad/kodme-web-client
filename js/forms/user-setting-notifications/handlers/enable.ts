// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { PlatformBridge } from "../../../utils/platform.bridge.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { enableWeb } from "../functions/enable_web.js";
import { enableAndroid } from "../functions/enable_android.js";
import { enableElectron } from "../functions/enable_electron.js";

// Импортируем типы
import type { UserSettingNotifications } from "../index.js";

/**
 * ***************************************************************************
 * Включение уведомлений: маршрутизирует в web-ветку (Service Worker), либо
 * в нативную Android-ветку (мост PlatformBridge), либо в локальную ветку
 * десктоп-обёртки Electron (LocalStorage).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function enableHandler(form: UserSettingNotifications): Promise<void> {

    try {

        // Если это десктоп-обёртка Electron
        if (PlatformBridge.isElectron()) {

            // Включаем уведомления Electron
            await enableElectron(form);

            // Если это Android
        } else if (PlatformBridge.isAndroidDevice) {

            // Включаем уведомления
            await enableAndroid(form);

        } else {

            // Включаем web уведомления
            await enableWeb(form);

        }

    } catch (error) {
        Logger.error(error);

        // Toast
        Toast.error(getErrorMessage(error), {
            duration: 0
        });

    }

}
