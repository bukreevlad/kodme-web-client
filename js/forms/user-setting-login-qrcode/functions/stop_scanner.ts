// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettingLoginWithQRCode } from "../index.js";

/**
 * ***************************************************************************
 * Остановка сканера QR-кода (камера устройства).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function stopScanner(form: UserSettingLoginWithQRCode): Promise<void> {

    try {

        if (!form.scanning || !form.html5QrCode) return;

        await form.html5QrCode.stop();
        form.html5QrCode.clear();
        form.scanning = false;

    } catch (error) {
        Logger.error(error);
    }

}
