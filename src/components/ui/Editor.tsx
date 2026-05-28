import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import { Bold, Italic, Strikethrough, List, ListOrdered, CheckSquare, Heading2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEffect } from 'react';
import { MentionList } from './MentionList';
import { Profile } from '../../lib/supabase';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  mentionUsers?: Profile[];
}

export function Editor({ content, onChange, placeholder = 'Write something...', editable = true, mentionUsers = [] }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Mention.configure({
        HTMLAttributes: {
          class: 'text-indigo-400 font-medium px-1 bg-indigo-500/10 rounded-md',
        },
        suggestion: {
          items: ({ query }) => {
            return mentionUsers.filter(item => item.username.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);
          },
          render: () => {
            let component: ReactRenderer;
            let popup: any;

            return {
              onStart: props => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as any,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate(props) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
              },

              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                return component.ref?.onKeyDown(props);
              },

              onExit() {
                popup[0].destroy();
                component.destroy();
              },
            };
          },
        },
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[100px] text-slate-300',
      },
    },
  });

  // Update content if it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-900/50 flex flex-col">
      {editable && (
        <div className="flex items-center gap-1 p-2 border-b border-slate-800/60 bg-slate-800/30 shrink-0 flex-wrap">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            icon={<Bold size={14} />}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            icon={<Italic size={14} />}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            icon={<Strikethrough size={14} />}
          />
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            icon={<Heading2 size={14} />}
          />
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            icon={<List size={14} />}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            icon={<ListOrdered size={14} />}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive('taskList')}
            icon={<CheckSquare size={14} />}
          />
        </div>
      )}
      <div className="p-3 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, active, icon }: { onClick: () => void, active: boolean, icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "p-1.5 rounded-md flex items-center justify-center transition-colors",
        active ? "bg-indigo-500 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
      )}
    >
      {icon}
    </button>
  );
}
