import * as vscode from 'vscode';
import { TreeDataProvider } from './treeDataProvider';
import { TreeItem } from './models/TreeItem';

/**
 * Точка входа расширения
 * Инициализирует провайдер данных и регистрирует команды
 */
export function activate(context: vscode.ExtensionContext) {
  // Удаляем инициализацию локализации через config, она больше не нужна
  // VSCode автоматически загрузит файлы из папки l10n
  
  const treeDataProvider = new TreeDataProvider();
  
  const treeView = vscode.window.createTreeView('classNavigator', {
    treeDataProvider: treeDataProvider,
    dragAndDropController: {
      dropMimeTypes: ['application/vnd.code.tree.classNavigator'],
      dragMimeTypes: ['application/vnd.code.tree.classNavigator'],
      handleDrag: (sources: readonly TreeItem[], dataTransfer: vscode.DataTransfer) => {
        dataTransfer.set('application/vnd.code.tree.classNavigator', new vscode.DataTransferItem(sources[0]));
      },
      handleDrop: async (target: TreeItem | undefined, dataTransfer: vscode.DataTransfer) => {
        
        const source = dataTransfer.get('application/vnd.code.tree.classNavigator')?.value as TreeItem;
        if (!source) {
          vscode.window.showErrorMessage(vscode.l10n.t('Невозможно переместить элемент'));
          return;
        }

        if (!source.classNamePath) {
          vscode.window.showErrorMessage(vscode.l10n.t('Невозможно переместить элемент'));
          return;
        }

        // Если target undefined - значит переносим в корень
        if (!target) {
          // При переносе в корень используем только имя класса без пути
          const newClassNamePath = source.className;
          await treeDataProvider.moveToRoot(source, newClassNamePath);
          return;
        }

        if (!target.classNamePath) {
          vscode.window.showErrorMessage(vscode.l10n.t('Невозможно переместить элемент'));
          return;
        }

        // Проверка на перетаскивание элемента на самого себя
        if (source.classNamePath === target.classNamePath) {
          vscode.window.showWarningMessage(vscode.l10n.t('Нельзя переместить элемент на самого себя.'));
          return;
        }

        // Проверка на создание циклической зависимости
        if (target.classNamePath.startsWith(source.classNamePath)) {
          vscode.window.showWarningMessage(vscode.l10n.t('Нельзя переместить элемент в его потомка.'));
          return;
        }

        await treeDataProvider.moveClass(source, target);
      }
    }
  });

  // Регистрация команд
  const commands = [
    vscode.commands.registerCommand("classNavigator.rename", async (item: TreeItem) => {
      const newClassName = await vscode.window.showInputBox({
        prompt: vscode.l10n.t("prompt.renameClass"),
        value: item.className,
        validateInput: (value) => {
          return value && value.trim() ? null : vscode.l10n.t('validation.emptyClassName');
        }
      });

      if (newClassName) {
        await treeDataProvider.renameClass(item, newClassName.trim());
      }
    }),

    vscode.commands.registerCommand("classNavigator.addClass", async () => {
      const className = await vscode.window.showInputBox({
        prompt: vscode.l10n.t("prompt.addClass"),
        validateInput: (value) => {
          return value && value.trim() ? null : vscode.l10n.t('validation.emptyClassName');
        }
      });

      if (className) {
        await treeDataProvider.addNewClass(className.trim());
      }
    }),

    vscode.commands.registerCommand("classNavigator.addSubClass", async (item: TreeItem) => {
      const subClassName = await vscode.window.showInputBox({
        prompt: vscode.l10n.t("prompt.addSubClass", item.className),
        validateInput: (value) => {
          return value && value.trim() ? null : vscode.l10n.t('validation.emptySubClassName');
        }
      });

      if (subClassName) {
        await treeDataProvider.addSubClass(item, subClassName.trim());
      }
    }),

    vscode.commands.registerCommand("classNavigator.removeClass", async (item: TreeItem) => {
      const yesButton = vscode.l10n.t("confirm.yes");
      const confirm = await vscode.window.showWarningMessage(
        vscode.l10n.t("prompt.removeClass", item.className),
        { modal: true },
        yesButton
      );

      if (confirm === yesButton) {
        await treeDataProvider.removeClass(item);
      }
    })
  ];

  context.subscriptions.push(treeView, ...commands);
}

export function deactivate() {
  console.log('HTML Class Navigator extension deactivated');
}
