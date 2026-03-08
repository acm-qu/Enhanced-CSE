'use client';

import { ExternalLinkIcon, Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { ParsedCourseInfo } from '@/lib/content/course-info';

interface CourseInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceUrl?: string;
  fallbackCourseId?: string;
  fallbackTitle?: string;
}

interface CourseInfoApiResponse {
  course?: ParsedCourseInfo;
  error?: string;
}

export function CourseInfoDialog({
  open,
  onOpenChange,
  sourceUrl,
  fallbackCourseId,
  fallbackTitle
}: CourseInfoDialogProps) {
  const cacheRef = useRef<Map<string, ParsedCourseInfo>>(new Map());
  const [courseInfo, setCourseInfo] = useState<ParsedCourseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sourceUrl) {
      return;
    }

    const cached = cacheRef.current.get(sourceUrl);
    if (cached) {
      setCourseInfo(cached);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    setCourseInfo(null);
    setError(null);
    setLoading(true);

    const load = async () => {
      try {
        const response = await fetch(`/api/v1/courses/info?url=${encodeURIComponent(sourceUrl)}`, {
          signal: controller.signal
        });

        const payload = (await response.json()) as CourseInfoApiResponse;
        if (!response.ok || !payload.course) {
          throw new Error(payload.error ?? 'Unable to load course information right now.');
        }

        cacheRef.current.set(sourceUrl, payload.course);
        if (!isMounted) {
          return;
        }

        setCourseInfo(payload.course);
      } catch (loadError) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : 'Unable to load course information right now.';
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [open, sourceUrl]);

  const title = courseInfo?.title ?? fallbackTitle ?? 'Course information';
  const courseId = courseInfo?.courseId ?? fallbackCourseId;
  const creditHours = courseInfo?.creditHours?.text;

  const has = useCallback((scheduleType: 'lab' | 'lecture') => {
    if (courseInfo && courseInfo?.scheduleTypes.length > 1) {
      return courseInfo.scheduleTypes.some((type) => type.toLowerCase().includes(scheduleType));
    } else {
      return courseInfo?.scheduleTypes[0]?.toLowerCase().includes(scheduleType);
    }
  }, [courseInfo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(90vw,800px)] max-h-[88vh] overflow-hidden border-border/70 bg-card p-0">
        <div className="border-b border-border/70 px-5 py-4 sm:px-6">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex flex-wrap items-center gap-2">
              {courseId && (
                <Badge variant="outline" className="font-mono tracking-wide">
                  {courseId}
                </Badge>
              )}
              {creditHours && <Badge variant="secondary">{creditHours}</Badge>}
            </div>
            <DialogTitle className="text-xl sm:text-2xl">{title}</DialogTitle>
            <DialogDescription className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Qatar University CSE Course Details
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(88vh-7.5rem)] space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          {loading && (
            <div className="panel-muted flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading course details...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}

          {courseInfo && !loading && (
            <>
              <section className="panel-muted rounded-xl px-4 py-3">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Department</p>
                    <p className="mt-1 text-foreground/90 w-[90%]">{courseInfo.department ?? 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Levels</p>
                    <p className="mt-1 text-foreground/90 w-[90%]">{courseInfo.levels.join(', ') || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Schedule Types</p>
                    <p className="mt-1 text-foreground/90 w-[90%]">{courseInfo.scheduleTypes.map(x => x.split(' ')[0]).join(', ') || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Class Hours</p>
                    <p className="mt-1 text-foreground/90 w-[90%]">
                      {has('lab') && (courseInfo.labHours || 'N/A Lab Hours')}
                      {has('lab') && has('lecture') && <br />}
                      {has('lecture') && (courseInfo.lectureHours || 'N/A Lecture Hours')}
                    </p>
                  </div>
                </div>
              </section>

              {courseInfo.description && (
                <section className="panel-muted rounded-xl px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Description</p>
                  <p className="mt-2 text-sm leading-6 text-foreground/85">{courseInfo.description}</p>
                </section>
              )}

              {courseInfo.courseAttributes.length > 0 && (
                <section className="panel-muted rounded-xl px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Course Attributes</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {courseInfo.courseAttributes.map((attribute) => (
                      <Badge key={attribute} variant="outline">
                        {attribute}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {(courseInfo.prerequisites || courseInfo.corequisites || courseInfo.restrictions) && (
                <section className="panel-muted rounded-xl px-4 py-3 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Enrollment Rules</p>
                  {courseInfo.prerequisites && (
                    <div>
                      <p className="text-xs font-semibold text-foreground/85">Prerequisites</p>
                      <p className="mt-1 text-sm leading-6 text-foreground/80">{courseInfo.prerequisites}</p>
                    </div>
                  )}
                  {courseInfo.corequisites && (
                    <div>
                      <p className="text-xs font-semibold text-foreground/85">Corequisites</p>
                      <p className="mt-1 text-sm leading-6 text-foreground/80">{courseInfo.corequisites}</p>
                    </div>
                  )}
                  {courseInfo.restrictions && (
                    <div>
                      <p className="text-xs font-semibold text-foreground/85">Restrictions</p>
                      <p className="mt-1 text-sm leading-6 text-foreground/80">{courseInfo.restrictions}</p>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {sourceUrl && (
            <div className="flex justify-end pb-1">
              <Button asChild variant="outline" size="sm">
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                  Open in myBanner
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
