import { TaskPriority } from "@prisma/client";

// Общая форма для "Календаря" (личного /calendar и вкладки "Загрузка и
// сроки" на странице департамента, см. components/calendar/deadline-calendar.tsx)
// — единица со сроком, приоритетом и ссылкой, независимо от того, откуда
// она взялась (личная задача, задача проекта, задача департамента).
export type CalendarDeadlineItem = {
  id: string;
  title: string;
  priority: TaskPriority;
  deadline: Date;
  subtitle: string;
  href: string;
};
