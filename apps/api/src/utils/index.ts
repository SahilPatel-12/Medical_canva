/**
 * API-specific utility helpers placeholder
 */
export function formatErrorResponse(code: string, message: string) {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}
