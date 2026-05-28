import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-slate-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            'bg-sky-500 text-white hover:bg-sky-500/90 shadow-[0_0_15px_rgba(14,165,233,0.15)]': variant === 'default',
            'bg-red-500 text-white hover:bg-red-500/90': variant === 'destructive',
            'border border-slate-700 bg-transparent hover:bg-slate-800 text-slate-200': variant === 'outline',
            'bg-slate-800 text-slate-100 hover:bg-slate-800/80': variant === 'secondary',
            'hover:bg-slate-800 text-slate-300 hover:text-slate-50': variant === 'ghost',
            'text-sky-400 underline-offset-4 hover:underline': variant === 'link',
            
            'h-10 px-4 py-2': size === 'default',
            'h-8 rounded-md px-3 text-xs': size === 'sm',
            'h-11 rounded-md px-8': size === 'lg',
            'h-9 w-9': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
