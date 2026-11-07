// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем requests
import { getLoginQRCodeRequest } from "../requests/get_qr_code.js";

// Импортируем типы
import type { LoginWithQRCode } from "../index.js";

/**
 * ***************************************************************************
 * Запрашивает QR-код авторизации и отрисовывает его в форме.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function getQRCode(form: LoginWithQRCode): Promise<void> {

    try {

        // Запрос
        const response = await getLoginQRCodeRequest();
        if (!response.status || !response.data) throw new Error("Не смогли получить qr код");

        // Устанавливаем элементы
        const image = form.tpl?.querySelector<HTMLImageElement>(":scope >.content [data-qr-code]");
        if (image) image.src = response.data.qr_image;

        // Записываем данные
        form.qrId = response.data.qr_id;

    } catch (error) {
        Logger.error(error);
    }

}
