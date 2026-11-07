// Импортируем components
import { Toast } from "../../../../../../components/toast.js";

// Импортируем типы
import type { RemoveMessage } from "../index.js";

/**
 * ***************************************************************************
 * removeHandler - подтверждение удаления: передаёт выбор чекбокса
 * вызывающему коду и закрывает диалог.
 * @param form - Форма диалога.
 * ***************************************************************************
 */
export async function removeHandler(form: RemoveMessage): Promise<void> {

    // Устанавливаем элементы
    let forAll = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="for-all"]`);

    try {

        // Отправляем ответ (колбэк задаёт вызывающий код — без него просто закрываем)
        // Чекбокс «для всех» — UI-флаг: нет элемента ⇒ не отмечен
        form.callback?.({
            for_all: forAll?.checked ?? false
        });
        form.modal?.close();

    } catch (error) {

        // Если неверный link
        Toast.error(error instanceof Error ? error : String(error), { position: "bottom-center" });

    }

}
