// Импортируем handlers формы
import { removeShareLinkHandler } from "../../../handlers/remove_share_link.js";

// Импортируем типы
import type { CloudShareLinkRow } from "../../../types.js";
import type { ShareLinks } from "../index.js";

/**
 * ***************************************************************************
 * Отзыв ссылки-приглашения на элемент; список ссылок в диалоге обновляется
 * автоматически внутри обработчика формы.
 * Ошибки запроса разбираются и показываются в removeShareLinkHandler.
 * @param dialog - Экземпляр диалога списка ссылок.
 * @param link - Данные ссылки.
 * ***************************************************************************
 */
export async function revokeHandler(dialog: ShareLinks, link: CloudShareLinkRow): Promise<void> {

    // Отзываем ссылку (диалог обновится автоматически)
    await removeShareLinkHandler(dialog.form, link);

}
