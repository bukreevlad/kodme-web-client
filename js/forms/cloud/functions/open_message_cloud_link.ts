// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { getShareLinkInfoRequest } from "../requests/get_share_link_info.js";

// Импортируем forms
import { Cloud } from "../index.js";

// Импортируем dialogs
import { CloudFileInfo } from "../dialogs/file_info/index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Открытие облачной ссылки (https://<host>/cloud/<token>) из сообщения:
 * - ссылка на папку — открывает облако с этой папкой;
 * - ссылка на файл — открывает окно с информацией о файле и скачиванием.
 * @param token - Значение ссылки (токен).
 * @returns Успешно ли обработана ссылка.
 * ***************************************************************************
 */
export async function openMessageCloudLink(token: string): Promise<boolean> {

    try {

        // Получаем информацию о ссылке
        let response = await getShareLinkInfoRequest({ link: token });
        let item = response?.data?.item;

        // Ссылка на папку — открываем облако с этой папкой
        if (item?.item_type === "folder") {
            await Cloud.openShareLink(token);
            return true;
        }

        // Ссылка на файл — окно с информацией о файле
        if (item?.item_type === "file") {
            new CloudFileInfo({ link: token });
            return true;
        }

        return false;

    } catch (error) {

        // Если ссылка недействительна — показываем уведомление
        let message = typeof error === "object" && error !== null && "message" in error
            ? String(error.message)
            : "";
        if (message.includes("Ссылка недействительна")) {
            Toast.error(t("forms.messages.toasts.cloud_link_not_valid"));
        } else {
            Logger.error(error);
        }

        return false;

    }

}
