/**
 * Format a date string to Swedish locale (sv-SE)
 * @param date - Date string or Date object
 * @returns Formatted date string in Swedish locale
 */
export const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleDateString("sv-SE", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    });
};

/**
 * Format a date string to Swedish locale with long month name
 * @param date - Date string or Date object
 * @returns Formatted date string with long month name
 */
export const formatDateLong = (date: string | Date): string => {
    return new Date(date).toLocaleDateString("sv-SE", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};
