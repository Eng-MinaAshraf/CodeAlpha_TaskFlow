import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Profile } from '../../lib/supabase';
import { cn } from '../../lib/utils';

export const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.username });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return null;
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden py-1 min-w-[150px]">
      {props.items.map((item: Profile, index: number) => (
        <button
          className={cn(
            "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2",
            index === selectedIndex ? "bg-slate-700 text-slate-200" : "text-slate-400 hover:bg-slate-700/50"
          )}
          key={index}
          onClick={() => selectItem(index)}
        >
          <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center shrink-0 border border-slate-600">
            {item.avatar_url ? (
              <img src={item.avatar_url} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-[10px] font-medium">{item.username[0]?.toUpperCase()}</span>
            )}
          </div>
          {item.username}
        </button>
      ))}
    </div>
  );
});
