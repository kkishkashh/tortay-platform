// Плейсхолдер для пункта "Не назначен" в select — Radix/Base UI Select не
// поддерживает пустую строку как value, поэтому используем сентинел и
// разворачиваем его обратно в null на сервере при разборе formData (см.
// lib/tasks/actions.ts::parseTaskFields).
export const UNASSIGNED_MEMBER_VALUE = "__unassigned__";
