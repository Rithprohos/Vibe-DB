export const formatDateForInput = (value: any): string => {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)) return str.slice(0, 10);
  return "";
};
