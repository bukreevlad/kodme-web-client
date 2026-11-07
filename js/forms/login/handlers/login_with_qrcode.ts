// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { LoginWithQRCode } from "../../login-with-qrcode/index.js";

// Импортируем типы
import type { Login } from "../index.js";

/**
 * ***************************************************************************
 * Переход к авторизации по QR-коду.
 * @param form - Форма входа.
 * ***************************************************************************
 */
export async function loginWithQRCodeHandler(form: Login): Promise<void> {

    try {

        // Закрываем форму авторизации
        form.modal?.close();

        // Открываем форму
        new LoginWithQRCode({});

    } catch (error) {
        Logger.error(error);
    }

}
