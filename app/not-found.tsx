import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-6 py-16 sm:px-8 lg:px-10">
      <Card>
        <CardHeader>
          <Badge variant="outline">404</Badge>
          <Separator className="my-3" />
          <CardTitle className="text-3xl sm:text-4xl">Article Not Found</CardTitle>
          <CardDescription className="max-w-xl text-sm leading-7 text-foreground">
            The requested wiki article does not exist in the synced dataset.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/wiki">Back to Wiki</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
