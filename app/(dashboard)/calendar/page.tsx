import { PageHeader } from "@/components/layout/page-header";
import { DeadlineCalendar } from "@/components/calendar/deadline-calendar";
import { getMyCalendarDeadlineItems } from "@/lib/calendar/queries";
import { formatTodayLabel } from "@/lib/utils";

export default async function CalendarPage() {
  const deadlineItems = await getMyCalendarDeadlineItems();

  return (
    <>
      <PageHeader title="Календарь" subtitle={formatTodayLabel(new Date())} />
      <div className="p-8">
        <DeadlineCalendar items={deadlineItems} />
      </div>
    </>
  );
}
