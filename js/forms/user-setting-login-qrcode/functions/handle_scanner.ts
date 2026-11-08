// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { stopScanner } from "./stop_scanner.js";
import { startScanner } from "./start_scanner.js";

// Импортируем requests
import { scannedRequest } from "../requests/scanned.js";

// Импортируем forms
import { ConfirmQRCodeLogin } from "../dialogs/confirm-qrcode-login/index.js";

// Импортируем типы
import type { UserSettingLoginWithQRCode } from "../index.js";

/**
 * ***************************************************************************
 * Обработка отсканированного QR-кода: останавливает камеру, отправляет
 * отметку на сервер и открывает диалог подтверждения входа. При ошибке
 * возвращает сканер обратно.
 * @param form - Экземпляр формы.
 * @param qrData - Строковые данные qr-кода.
 * ***************************************************************************
 */
export async function handleScanner(form: UserSettingLoginWithQRCode, qrData: string): Promise<void> {

    try {

        // Останавливаем сканирование
        await stopScanner(form);

        // Парсим данные
        let parsedData = JSON.parse(qrData);

        // Отправляем на сервер
        let response = await scannedRequest({ qr_data: parsedData });

        // ResponseHandler бросает ApiError при не-2xx —
        // тело успешного ответа всегда status: true

        // Закрываем форму
        form.modal?.close();

        // Открываем диалог подтверждения
        new ConfirmQRCodeLogin({
            userId: form.userId,
            scannedResult: response.data
        });

    } catch (error) {
        Logger.error(error);

        // Если ошибка — запускаем сканер обратно
        await startScanner(form);
    }

}
