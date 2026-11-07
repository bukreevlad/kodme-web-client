// Импортируем config
import { getLimits } from "../../../config/limits.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Inputs } from "../../../components/inputs.js";
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { StickerPaks } from "../../sticker-paks/index.js";
import { StickerPak } from "../../sticker-pak/index.js";

// Импортируем requests
import { createPakRequest } from "../requests/create.js";

// Импортируем типы
import type { StickerPakCreate } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание пака стикеров по данным формы.
 *
 * После успеха: новый пак добавляется в список (если открыт) и сразу
 * открывается его содержимое — автор попадает в пак для загрузки стикеров.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function stickerPakCreateHandler(form: StickerPakCreate): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    const name = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
    const about = tpl.querySelector<HTMLTextAreaElement>(`:scope >.content [name="about"]`);
    const isPublic = tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);

    // Без имени формы нет
    if (!name) return;

    // Лимиты длины из авторизации; не приняты — длину проверяет сервер
    const limits = getLimits();

    // Название: обязательно, без пустых значений
    const nameValue = name.value.trim();
    if (!nameValue || (limits !== null && nameValue.length > limits.stickers.pak_name_max_length)) {
        Inputs.markInvalid(name, true);
        Toast.error(t("forms.sticker_pak_create.toasts.name_invalid"));
        return;
    }
    Inputs.clearInvalid(name);

    // Описание: пустое значение уходит как null (сервер хранит null)
    const aboutValue = about?.value.trim() || null;
    if (aboutValue && limits !== null && aboutValue.length > limits.stickers.pak_about_max_length) {
        if (about) Inputs.markInvalid(about, true);
        Toast.error(t("forms.sticker_pak_create.toasts.about_invalid"));
        return;
    }
    if (about) Inputs.clearInvalid(about);

    try {

        // Запрос создания
        const response = await createPakRequest({
            name: nameValue,
            about: aboutValue,
            is_public: isPublic?.checked ?? false
        });

        // Закрываем форму создания
        form.modal?.close();

        // Неожиданный ответ — дальше открыть пак неоткуда
        if (!response?.data?.id) return;

        // Добавляем пак в список (если открыт) — плашка встанет в конец
        StickerPaks.instance?.store.add(response.data);

        // Открываем содержимое нового пака
        new StickerPak({ pakId: response.data.id });

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][sticker-pak-create][create-pak]",
            fallback: t("forms.sticker_pak_create.toasts.create_error")
        });

    }

}
