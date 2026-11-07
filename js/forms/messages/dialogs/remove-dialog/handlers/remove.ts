// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем типы
import type { RemoveDialog } from "../index.js";

/**
 * ***************************************************************************
 * Отправить ответ диалога удаления (значение checkbox «удалить для всех»)
 * и закрыть диалог.
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function removeHandler(form: RemoveDialog): Promise<void> {

    // Устанавливаем элементы
    let forAll = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="for-all"]`);

    try {

        // Отправляем ответ
        // Чекбокс «для всех» — UI-флаг: нет элемента ⇒ не отмечен
        form.callback({
            for_all: forAll?.checked ?? false
        });
        form.modal?.close();

    } catch (error) {

        // Если не удалось отправить ответ
        Toast.error(error instanceof Error ? error : String(error), { position: "bottom-center" });

    }

}
