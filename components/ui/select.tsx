import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-9 w-full rounded-md border border-foreground/15 bg-foreground/5 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground/25',
      className
    )}
    {...props}
  />
));
Select.displayName = 'Select';

export { Select };
