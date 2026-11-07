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
import { updatePakRequest } from "../requests/update.js";

// Импортируем типы
import type { StickerPakEdit } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение изменений пака стикеров (название, описание, публичность).
 *
 * После успеха плашка пака в списке обновляется через стор (событие
 * `item::updated::<id>` перерисовывает её), а если содержимое пака открыто
 * в `sticker-pak` — у него обновляются название и заголовок.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function stickerPakSaveHandler(form: StickerPakEdit): Promise<void> {

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
        Toast.error(window._lc.forms.sticker_pak_edit.toasts.name_invalid);
        return;
    }
    Inputs.clearInvalid(name);

    // Описание: пустое значение уходит как null (сервер хранит null)
    const aboutValue = about?.value.trim() || null;
    if (aboutValue && limits !== null && aboutValue.length > limits.stickers.pak_about_max_length) {
        if (about) Inputs.markInvalid(about, true);
        Toast.error(window._lc.forms.sticker_pak_edit.toasts.about_invalid);
        return;
    }
    if (about) Inputs.clearInvalid(about);

    const isPublicValue = isPublic?.checked ?? false;

    try {

        // Запрос обновления
        await updatePakRequest({
            pak_id: form.pakId,
            name: nameValue,
            about: aboutValue,
            is_public: isPublicValue
        });

        // Закрываем форму редактирования
        form.modal?.close();

        // Toast
        Toast.success(window._lc.forms.sticker_pak_edit.toasts.success);

        // Обновляем плашку пака в списке (если открыт) — перерисуется по событию
        const listForm = StickerPaks.instance;
        const item = listForm?.store.get(form.pakId);
        if (listForm && item) {
            listForm.store.update(form.pakId, {
                ...item,
                name: nameValue,
                about: aboutValue,
                is_public: isPublicValue
            });
        }

        // Обновляем открытую форму содержимого этого же пака
        const contentForm = StickerPak.instances.get(form.pakId);
        if (contentForm?.pak) {
            contentForm.pak.name = nameValue;
            contentForm.pak.about = aboutValue;
            contentForm.pak.is_public = isPublicValue;

            // Заголовок формы содержимого — название пака
            const title = contentForm.tpl?.querySelector(":scope >.header [data-title]");
            if (title) title.textContent = nameValue;
        }

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][sticker-pak-edit][save-pak]",
            fallback: window._lc.forms.sticker_pak_edit.toasts.save_error
        });

    }

}
