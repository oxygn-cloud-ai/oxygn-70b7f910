import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const VARIABLE_PATTERN = /\{\{[^}]+\}\}/g;

/**
 * Tiptap extension that highlights {{variable}} patterns in the editor
 * Uses ProseMirror decorations to apply a CSS class to matching text
 */
export const VariableHighlight = Extension.create({
  name: 'variableHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('variableHighlight'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;

              // Reset regex for each text node
              VARIABLE_PATTERN.lastIndex = 0;
              
              let match;
              while ((match = VARIABLE_PATTERN.exec(node.text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'variable-highlight',
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

export default VariableHighlight;
