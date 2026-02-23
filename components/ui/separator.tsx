import * as React from 'react';

import { cn } from '@/lib/utils';

function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('h-px w-full bg-foreground/12', className)} {...props} />;
}

export { Separator };
