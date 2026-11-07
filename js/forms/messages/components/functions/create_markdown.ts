// Импортируем сторонние пакеты
import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";
import type { MarkdownIt as MarkdownItInstance } from "markdown-it";

// Импортируем config
import { MARKDOWN_RULES_DISABLED_FOR_USER } from "../../../../config/constants.js";
import { MARKDOWN_RULES_DISABLED_FOR_BOT } from "../../../../config/constants.js";

// Импортируем utils
import { Icons } from "../../../../utils/icons.js";
import { Logger } from "../../../../utils/logs/logger.js";
import { normalizeIndentation } from "../../../../utils/helpers/normalize_indentation.js";

// Импортируем plugins
import { renderBotCommands } from "./render_bot_commands.js";
import { mentionRenderPlugin } from "./render_mentions.js";
import { inviteLinkRenderPlugin } from "./render_invite_link.js";
import { cloudShareLinkRenderPlugin } from "./render_cloud_share_link.js";
import { urlLinkRenderPlugin } from "./render_url_link.js";
import { blockquoteClassPlugin } from "./render_blockquote.js";
import { codeClassPlugin } from "./render_code.js";

/**
 * Настройки выбора markdown-it рендерера.
 */
export interface MarkdownRendererOptions {

    /** Сообщение от бота (другой набор правил). */
    isBot?: boolean;

}

/**
 * ***************************************************************************
 * Кэш готовых инстансов markdown-it: ключ — вариант правил ("bot"/"user").
 *
 * Зачем:
 * - Раньше в `message.js` жил ОДИН общий экземпляр `renderMarkdown`, и перед
 *   каждым рендером его правила переключались вызовом `disable(...)`.
 *   Если два сообщения рендерились вперемешку (бот + человек, перерисовка,
 *   догрузка истории), правила применялись не к тому сообщению.
 * - Теперь экземпляр неизменяем после создания: берём нужный вариант из кэша
 *   и рендерим им, ничего не мутируя на лету.
 *
 * Инстансы создаются лениво и по одному разу на вариант (создание MarkdownIt
 * с плагинами заметно дороже рендера, а вариантов всего два).
 * ***************************************************************************
 */
const renderers = new Map<string, MarkdownItInstance>();

/**
 * ***************************************************************************
 * Получить markdown-it рендерер для сообщения.
 * @param options - Опции.
 * @param options.isBot - Сообщение от бота (другой набор правил).
 * @returns Готовый к использованию рендерер.
 * ***************************************************************************
 */
export function getMarkdownRenderer(options: MarkdownRendererOptions = {}): MarkdownItInstance {

    // Ключ варианта: правила бота и пользователя различаются
    const variant = options.isBot ? "bot" : "user";

    // Экземпляр уже создан — возвращаем его (создание не должно повторяться)
    const cached = renderers.get(variant);
    if (cached) return cached;

    // Создаём новый экземпляр
    const renderer = createRenderer(variant);

    // Отключаем правила сразу при создании и больше не трогаем конфигурацию
    renderer.disable(variant === "bot"
        ? MARKDOWN_RULES_DISABLED_FOR_BOT
        : MARKDOWN_RULES_DISABLED_FOR_USER);

    // Кэшируем и отдаём
    renderers.set(variant, renderer);

    return renderer;

}

/**
 * ***************************************************************************
 * Создать новый экземпляр MarkdownIt с подсветкой синтаксиса и плагинами.
 * @param variant - Вариант правил ("bot"/"user") — только для подписи.
 * @returns Настроенный рендерер.
 * ***************************************************************************
 */
function createRenderer(variant: string): MarkdownItInstance {

    // Ссылка на себя нужна внутри highlight (экранирование) — задаём после создания
    let renderer: MarkdownItInstance;

    // Подсветка живёт отдельной функцией: её же вызывает переопределённый
    // рендерер fence ниже — options.highlight у markdown-it объявлен
    // необязательным, а этот рендерер работает только с нашей функцией
    const highlight = (str: string, lang: string): string => {

        // Убираем лишние отступы внутри блока кода
        str = normalizeIndentation(str);

        // Подсветка синтаксиса, если язык известен
        let highlightedCode = "";
        if (lang && hljs.getLanguage(lang)) {
            try {
                highlightedCode = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
            } catch (error) {

                // Подсветка не удалась — экранируем текст как есть
                highlightedCode = renderer.utils.escapeHtml(str);

            }
        } else {
            highlightedCode = renderer.utils.escapeHtml(str);
        }

        // Класс языка для подсветки
        const langClass = lang ? `language-${lang}` : "";

        // Шаблон карточки блока кода с кнопкой копирования
        return `<div data-pre-code class="flex flex-col w-full bg-[var(--color-black)]/5 dark:bg-[var(--color-black)]/40 rounded-md overflow-hidden text-sm">
                    <div class="flex flex-row w-full p-1 px-2 bg-[var(--color-black)]/10 dark:bg-[var(--color-black)]/30 items-center justify-between">
                        <span>${lang || "Блок кода"}</span>
                        <button action-copy class="p-1 cursor-pointer">${Icons.icon("Copy")?.outerHTML}</button>
                    </div>
                    <pre class="flex relative p-3 max-h-[40rem]"><code class="hljs ${langClass}">${highlightedCode}</code></pre>
                </div>`;

    };

    renderer = new MarkdownIt({
        html: false,
        linkify: true,
        typographer: true,
        breaks: false,
        highlight
    });

    // ХАК: переопределяем стандартный рендерер "fence" (блоков кода ```),
    // чтобы markdown-it выводил то, что вернул highlight(), «как есть»,
    // без авто-обёртки в pre/code
    renderer.renderer.rules.fence = (tokens, idx) => {

        const token = tokens[idx];
        if (!token) return "";
        const info = token.info ? token.info.trim() : "";
        const langName = info.split(/\s+/)[0] ?? "";

        return highlight(token.content, langName);

    };

    // Подключаем свои плагины Markdown
    renderer.use(renderBotCommands);
    renderer.use(mentionRenderPlugin);
    renderer.use(inviteLinkRenderPlugin);
    renderer.use(cloudShareLinkRenderPlugin);
    renderer.use(urlLinkRenderPlugin);
    renderer.use(blockquoteClassPlugin);
    renderer.use(codeClassPlugin);

    Logger.debug(`[app][messages][markdown]: создан рендерер для варианта "${variant}".`);

    return renderer;

}
