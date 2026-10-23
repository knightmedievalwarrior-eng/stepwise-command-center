import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated, useTask, type Task } from "@/lib/session-store";

/** Waits for browser storage, then renders children with the task or a friendly empty state. */
export function TaskGate({ taskId, children }: { taskId: string; children: (task: Task) => ReactNode }) {
  const hydrated = useHydrated();
  const task = useTask(taskId);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!task) return <MissingTask />;
  return <>{children(task)}</>;
}

export function MissingTask() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
        <FileQuestion className="size-5 text-muted-foreground" />
      </div>
      <h1 className="mt-5 text-xl font-semibold">ไม่พบงานนี้</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        งานอาจเสร็จสิ้นไปแล้ว หรือข้อมูลถูกลบเมื่อปิดแท็บ เพื่อความเป็นส่วนตัวของลูกค้า
      </p>
      <Button asChild className="mt-6">
        <Link to="/">กลับ Command Center</Link>
      </Button>
    </div>
  );
}
