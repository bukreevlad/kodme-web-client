// Импортируем сторонние пакеты
import Validator from "validator";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { editAppRequest } from "../requests/edit_app.js";

// Импортируем типы
import type { EditBotApp } from "../index.js";

// Импортируем utils
import { getErrorMessage } from "../../../utils/helpers/error_util.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Сохранение приложения бота: проверка полей формы и запрос к API.
 *
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function saveHandler(form: EditBotApp): Promise<void> {

    // Устанавливаем элементы
    let nameEl = form.tpl?.querySelector<HTMLInputElement>(":scope >.content [name=name]");
    let linkEl = form.tpl?.querySelector<HTMLInputElement>(":scope >.content [name=link]");
    let aboutEl = form.tpl?.querySelector<HTMLInputElement>(":scope >.content [name=about]");
    let urlEl = form.tpl?.querySelector<HTMLInputElement>(":scope >.content [name=url]");

    // Получаем значения с очисткой от краевых пробелов
    let name = nameEl ? nameEl.value.trim() : "";
    let link = linkEl ? linkEl.value.trim() : "";
    let about = aboutEl ? aboutEl.value.trim() : "";
    let url = urlEl ? urlEl.value.trim() : "";

    try {

        // Регулярные выражения
        let pregName = /^[\p{sc=Cyrillic}\p{sc=Common}\p{sc=Latin}]{2,64}$/su;
        let pregAbout = /^[\p{sc=Cyrillic}\p{sc=Common}\p{sc=Latin}]{0,255}$/mu;
        let pregLink = /^[a-z0-9_]{1,32}$/s;

        // Проверяем name
        if (!Validator.matches(name, pregName)) {
            throw t("forms.bot_editor.name_long");
        }

        // Проверяем about
        if (about && !Validator.matches(about, pregAbout)) {
            throw t("forms.bot_editor.description");
        }

        // Проверяем link
        if (link && !Validator.matches(link, pregLink)) {
            throw t("forms.bot_editor.link");
        }

        // Проверяем url (исправлен регистр Validator и выброс простой строки)
        if (!Validator.isURL(url, {
            protocols: ["https"],
            require_protocol: true,
            require_tld: true,
            require_host: true,
            allow_query_components: true,
            allow_fragments: true,
            disallow_auth: true,
            validate_length: true
        })) {
            throw t("forms.bot_editor.url_https");
        }

        // Запрос к API
        let response = await editAppRequest({
            bot_app_id: form.app?.id,
            name: name,
            link: link || null,
            about: about || null,
            url: url
        });

        // Проверка ответа
        if (response && response.status) {
            form.modal?.close();
        }

    } catch (error) {
        // Если пришла ошибка из слоя запроса (объект Error), берем .message, иначе простую строку
        let errorMessage = typeof error === "string" ? error : (getErrorMessage(error) || t("forms.bot_editor.error"));
        Toast.error(errorMessage, { position: "bottom-center" });
    }

}
