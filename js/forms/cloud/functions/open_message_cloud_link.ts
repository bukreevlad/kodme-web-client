// Импортируем utils
import { getErrorMessage } from "../../../utils/helpers/error_util.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { getShareLinkInfoRequest } from "../requests/get_share_link_info.js";

// Импортируем forms
import { Cloud } from "../index.js";

// Импортируем handlers
import { LINK_ERROR_CODES } from "../handlers/open_share_link.js";

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

        // Ссылка отозвана/истекла/удалена — свой текст; прочие ошибки
        // (сеть, таймаут, 5xx) разбирает toastError
        let message = getErrorMessage(error);

        if (LINK_ERROR_CODES.some(code => message.includes(code))) {
            Toast.error(t("forms.messages.toasts.cloud_link_not_valid"));
        } else {
            toastError(error, {
                context: "[app][cloud][open-message-cloud-link]",
                fallback: t("api.errors.server_error")
            });
        }

        return false;

    }

}
