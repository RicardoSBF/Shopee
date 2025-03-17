/**
 * Driver status utility functions
 */

export type DriverStatus = "active" | "pending" | "inactive";

/**
 * Calculate driver status based on verification date
 * @param verificationDate - The date of the last verification
 * @returns The status of the driver
 */
export function calculateDriverStatus(
  verificationDate: string | null,
): DriverStatus {
  if (!verificationDate) return "pending";

  const now = new Date();
  const lastVerification = new Date(verificationDate);

  // Calculate days since last verification
  const diffTime = Math.abs(now.getTime() - lastVerification.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 3) {
    return "active"; // Within verification period (3 days)
  } else if (diffDays <= 10) {
    return "pending"; // Verification expired but within grace period
  } else {
    return "inactive"; // More than 10 days without verification
  }
}

/**
 * Get a human-readable status text
 * @param status - The driver status
 * @returns A human-readable status text
 */
export function getStatusText(status: DriverStatus): string {
  switch (status) {
    case "active":
      return "Ativo";
    case "pending":
      return "Pendente";
    case "inactive":
      return "Inativo";
    default:
      return "Desconhecido";
  }
}
