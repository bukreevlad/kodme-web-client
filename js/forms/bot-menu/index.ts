// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Toast } from "../../components/toast.js";

// Импортируем components
import { createCategoryItem } from "./components/category.js";
import { createPathItem } from "./components/path.js";
import { createBotItem } from "./components/bot.js";
import { createCommandItem } from "./components/command.js";

// Импортируем типы
import type { OverlayOptions } from "../../components/overlay/types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Узел дерева меню бота: категория либо команда.
 *
 * Поля — только те, что реально читает форма (компоненты строк, построение
 * дерева и хлебная крошка); состав различается по типам узлов, поэтому
 * поля опциональны.
 */
export interface BotMenuNode {

    /** Id узла (UUID строки). */
    id: string;

    /** Название категории либо описание команды. */
    name?: string;

    /** Текст команды (только у команды — вставляется в поле ввода). */
    command?: string;

    /** Описание команды (подсказка в title). */
    about?: string;

    /** Id родительской категории (null/undefined — корень). */
    categoryId?: string | null;

    /** Дочерние узлы — заполняется при построении дерева. */
    children?: BotMenuNode[];

    /** Отображённые DOM-копии узла. */
    __domElements__?: HTMLElement[];

}

/**
 * Дерево меню бота: массив корневых узлов плюс служебное имя корня,
 * которое пишет хлебная крошка (`./Меню`). Легаси мутировал массив —
 * контракт сохранён типом, расширяющим Array.
 */
export interface BotMenuTree extends Array<BotMenuNode> {

    /** Подпись корневого элемента пути. */
    name?: string;

    /** Отображённые DOM-копии корня. */
    __domElements__?: HTMLElement[];

}

/**
 * Бот со своими командами в составе канала.
 *
 * Поля — только те, что реально читает форма: список ботов, дерево меню,
 * публичная ссылка строки.
 */
export interface BotMenuBot {

    /** Id бота. */
    id: string;

    /** Публичная ссылка бота (подпись строки). */
    link?: string;

    /** Команды и категории меню бота. */
    bot_commands?: BotMenuNode[];

    /** Отображённые DOM-копии строки бота. */
    __domElements__?: HTMLElement[];

}

/**
 * Настройки формы меню бота.
 */
export interface BotMenuOptions {

    /** Включить/Выключить overlay. */
    overlay?: boolean;

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null | undefined;

    /** Целевой элемент DOM, относительно которого позиционируется форма. */
    targetNode?: HTMLElement | null | undefined;

    /** Направление открытия относительно targetNode. */
    targetNodeDirection?: OverlayOptions["targetNodeDirection"];

    /** Координата X для отображения. */
    x?: number | undefined;

    /** Координата Y для отображения. */
    y?: number | undefined;

    /** Отступы по X и Y от targetNode. */
    margin?: OverlayOptions["margin"];

}

/**
 * Данные конструктора формы.
 */
export interface BotMenuData {

    /** Массив ботов с их командами. */
    bots: BotMenuBot[];

    /** Настройки формы. */
    options?: BotMenuOptions;

    /** Выбор команды: получает узел дерева, на который нажали. */
    callback?: (command: BotMenuNode) => void;

}

// Form
export class BotMenu {

    // Переменная для хранения единственного экземпляра формы
    static instance: BotMenu | null = null;

    /** Настройки формы. */
    options: BotMenuOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Инстанс OverlayScrollbars контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Контент формы (для скроллбара). */
    content: HTMLElement | null = null;

    /** Список ботов (шапка). */
    botList: HTMLElement | null = null;

    /** Список пути до категории (шапка). */
    pathList: HTMLElement | null = null;

    /** Список меню бота (контент). */
    menuList: HTMLElement | null = null;

    /** Боты с их командами. */
    bots: BotMenuBot[];

    /** Дерево меню текущего бота. */
    menuTree: BotMenuTree = [];

    /** Id открытой категории (null — корень меню). */
    currentCategoryId: string | null = null;

    /** Колбэк выбора команды. */
    callback: ((command: BotMenuNode) => void) | null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.bots - Массив ботов с их командами.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * @param data.options.targetNode - Целевой элемент позиционирования.
     * @param data.options.targetNodeDirection - Направление открытия.
     * @param data.options.x - Координата X для отображения.
     * @param data.options.y - Координата Y для отображения.
     * @param data.options.margin - Отступы от targetNode.
     * @param data.callback - Callback выбора команды.
     * ***************************************************************************
     */
    constructor(data: BotMenuData) {

        // Если не передан bots
        if (!data?.bots) throw new Error("Не передан: bots");


        // Устанавливаем настройки
        this.options = {
            insertInto: data.options?.insertInto,
            targetNode: data.options?.targetNode,
            targetNodeDirection: data.options?.targetNodeDirection,
            x: data.options?.x,
            y: data.options?.y,
            margin: data.options?.margin || [0, 0, 10, 0],
            ...data?.options
        }

        // Переменные формы
        this.bots = data.bots;
        this.callback = data.callback || null;

        // Проверяем, существует ли уже экземпляр
        if (BotMenu.instance) {
            return BotMenu.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        BotMenu.instance = this;

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Открытие
        await this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "popover",
                fit: "shrink",
                url: `?bot-menu`,
                insertInto: this.options.insertInto,
                targetNode: this.options?.targetNode,
                targetNodeDirection: this.options?.targetNodeDirection,
                overlay: this.options?.overlay,
                margin: this.options?.margin,
                closeOnEsc: true,
                closeOnOverlay: true,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        // Элементы формы обрабатываются в компонентах списка: отдельных
        // кнопок в шапке у этой формы нет

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.botList = this.tpl.querySelector<HTMLElement>(":scope >.header [data-bots]");
            this.pathList = this.tpl.querySelector<HTMLElement>(":scope >.header [data-path]");
            this.menuList = this.tpl.querySelector<HTMLElement>(":scope >.content [data-menu]");

            // Списки обязаны входить в шаблон — иначе заполнять нечего
            if (!this.botList || !this.menuList || !this.pathList) return;

            // Очищаем списки
            this.botList.innerHTML = "";
            this.menuList.innerHTML = "";
            this.pathList.innerHTML = "";

            // Инициализируем скролл
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Обновление формы
            this.update(this.bots);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Обновление формы
    // ***************************************************************************
    update(data: BotMenuBot[]): void {

        // Обновляем данные
        this.bots = data;

        // Если есть боты
        if (this.bots.length > 0) {

            // Если бот только один
            if (this.bots.length === 1) {

                // Если есть команды бота
                const bot = this.bots[0];
                if (bot?.bot_commands) {

                    // Создаем дерево меню
                    this.menuTree = this.buildTreeArray(bot.bot_commands);

                    // Формируем меню
                    this.showMenuBot(this.menuTree);

                }

            } else {

                // Отображаем ботов в списке
                this.showBotList(this.bots);

            }

        }

    }



    // ***************************************************************************
    // Отображение меню бота
    // ***************************************************************************
    showMenuBot(array: BotMenuNode[]): void {

        // Список
        let list = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-menu]");

        // Без списка отображать нечего
        if (!list) return;
        list.innerHTML = "";

        // Проходим по списку
        array.forEach(i => {

            // Если это команда
            if (i.command) {

                // создаем элемент
                let command = createCommandItem(i);
                list.append(command);

                // Клик: нажали на команду
                command?.addEventListener("click", () => {
                    this.callback && this.callback(i);
                    this.modal?.close();
                });

            }

            // Если это категория
            if (!i.command) {

                // создаем элемент
                let category = createCategoryItem(i);
                list.append(category);

                // Клик: открытие категории
                category?.addEventListener("click", () => {

                    // Отображаем категорию (у категории без детей — пустое меню)
                    this.showMenuBot(i.children ?? []);
                    this.currentCategoryId = i.id;

                    // Генерируем путь до категории
                    let path = this.genPathToCurrentCategory(this.menuTree, i.id);
                    this.updatePath(path);

                });

            }

        });

    }

    // ***************************************************************************
    // Построение дерева комманд
    // ***************************************************************************
    buildTreeArray(array: BotMenuNode[]): BotMenuTree {

        // Устанавливаем параметры
        let nodeMap: Record<string, BotMenuNode> = {};
        let result: BotMenuTree = [];

        // Проходим по массиву
        array.forEach(item => {
            nodeMap[item.id] = { ...item, children: [] };
        });

        // Создаем дерево из массива
        array.forEach(item => {
            let node = nodeMap[item.id];
            if (!node) return;
            if (item.categoryId != null) {
                nodeMap[item.categoryId]?.children?.push(node);
            } else {
                result.push(node);
            }
        });

        return result;

    }

    // ***************************************************************************
    // Получить путь до текущей категории
    // ***************************************************************************
    genPathToCurrentCategory(tree: BotMenuNode[], targetId: string): BotMenuNode[] | null {

        // Рекурсивная функция для обхода дерева
        const traverse = (node: BotMenuNode, path: BotMenuNode[] = []): BotMenuNode[] | null => {
            if (node.id === targetId) {
                return [...path, node];
            }

            // Если содержит потомков
            if (node.children) {
                for (let child of node.children) {
                    const result = traverse(child, [...path, node]);
                    if (result) {
                        return result;
                    }
                }
            }
            return null;
        };

        // Проходим по всем элементам массива
        for (let node of tree) {
            const result = traverse(node);
            if (result) {
                return result;
            }
        }
        return null;

    }

    // ***************************************************************************
    // Отображение пути до категории
    // ***************************************************************************
    updatePath(path: BotMenuNode[] | null): void {

        // Список категорий
        let list = this.tpl?.querySelector<HTMLElement>(":scope >.header [data-path]");

        // Без списка отображать нечего
        if (!list) return;
        list.innerHTML = "";

        // Создаем корневой элемент и отображаем
        let root = this.menuTree;
        root.name = `./${t("forms.bot_menu.menu")}`;
        let item = createPathItem(root);
        list.append(item);

        // Клик: перейти в категорию
        item?.addEventListener("click", () => {

            // Отображаем категорию
            this.showMenuBot(this.menuTree);
            this.currentCategoryId = null;

            // Генерируем путь до категории
            let path = this.genPathToCurrentCategory(this.menuTree, "");
            this.updatePath(path);

        });

        // Перебираем элементы пути
        path && path.forEach(p => {

            // Создаем элемент и отображаем
            let item = createPathItem(p);
            list.append(item);

            // Клик: перейти в категорию
            item?.addEventListener("click", () => {

                // Отображаем категорию (у категории без детей — пустое меню)
                this.showMenuBot(p.children ?? []);
                this.currentCategoryId = p.id;

                // Генерируем путь до категории
                let path = this.genPathToCurrentCategory(this.menuTree, p.id);
                this.updatePath(path);

            });

        });

    }

    // ***************************************************************************
    // Отображение списка ботов
    // ***************************************************************************
    showBotList(bots: BotMenuBot[]): void {

        // Если нет ботов
        if (!bots) return;

        // Устанавливаем параметры
        let botList = this.tpl?.querySelector<HTMLElement>(":scope >.header [data-bots]");

        // Без списка отображать нечего
        if (!botList) return;

        // Проходим по ботам
        bots.forEach(b => {

            // Создаем Элемент
            let item = createBotItem(b);
            botList.append(item);

            // При клике на боте
            item?.addEventListener("click", e => {

                // Если есть команды
                if (b.bot_commands) {

                    // Создаем дерево меню
                    this.menuTree = this.buildTreeArray(b.bot_commands);

                    // Формируем меню
                    this.showMenuBot(this.menuTree);

                } else {

                    // Отображаем сообщение, что нет меню бота
                    Toast.info(t("forms.bot_menu.toasts.bot_not_menu"));

                }

            });

        });

    }



    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        BotMenu.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-modal bot-menu flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="header flex flex-col gap-0 p-3 bg-[var(--second-bg)] justify-start">
                    <span data-title class="font-semibold">${t("forms.bot_menu.title")}</span>
                    <div data-bots class="flex flex-row"></div>
                    <div data-path class="flex flex-row flex-wrap gap-1"></div>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <div data-menu class="flex flex-col gap-0"></div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
