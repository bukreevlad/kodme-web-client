// Импортируем сторонние пакеты
import { Html5Qrcode } from "html5-qrcode";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { handleScanner } from "./handle_scanner.js";

// Импортируем типы
import type { UserSettingLoginWithQRCode } from "../index.js";

/**
 * ***************************************************************************
 * Запуск сканера QR-кода (камера устройства).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function startScanner(form: UserSettingLoginWithQRCode): Promise<void> {

    try {

        // Если сканирование запущено
        if (form.scanning) return;

        // Устанавливаем флаг
        form.scanning = true;

        // Инициализируем Html5Qrcode
        form.html5QrCode = new Html5Qrcode("video-qrcode-container");

        // Начинаем сканирование с использованием video элемента
        await form.html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            (decodedText) => { handleScanner(form, decodedText) },
            (errorMessage) => { }
        ).catch((err) => {
            Logger.error("Не удалось запустить сканер:", err);
            form.scanning = false;
        });

    } catch (error) {
        Logger.error(error);
    }

}
