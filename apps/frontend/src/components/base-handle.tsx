import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { Handle, HandleProps } from '@xyflow/react';

import { cn } from '@/lib/utils';

export type BaseHandleProps = HandleProps;

const BaseHandleComponent = forwardRef<HTMLDivElement, BaseHandleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Handle
        ref={ref}
        {...props}
        className={cn(
          'h-[15px] w-[15px] rounded-full border-border  bg-secondary transition dark:border-secondary dark:bg-secondary',
          className
        )}
        {...props}
      >
        {children}
      </Handle>
    );
  }
);

BaseHandleComponent.displayName = 'BaseHandle';

export const BaseHandle: ForwardRefExoticComponent<BaseHandleProps & RefAttributes<HTMLDivElement>> = BaseHandleComponent;
