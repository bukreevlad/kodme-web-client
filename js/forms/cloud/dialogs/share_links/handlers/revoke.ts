// Импортируем handlers формы
import { FormsRegistry } from "../../../../../core/managers/forms_registry.js";
import { removeShareLinkHandler } from "../../../handlers/remove_share_link.js";

// Импортируем forms
import { Cloud } from "../../../index.js";

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

    // Форма облака нужна обработчику отзыва для обновления списка
    const cloud = FormsRegistry.getOwner<Cloud>("cloud");
    if (!cloud) return;

    // Отзываем ссылку (диалог обновится автоматически)
    await removeShareLinkHandler(cloud, link);

}
