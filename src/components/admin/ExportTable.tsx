import React from "react";
import "./ExportTableStyles.css";

interface ExportTableProps {
  data: Array<{
    gaiola: string;
    cidade: string;
    driver: string;
    taxaEntrega?: number;
    shift?: string;
  }>;
}

// Memoize the component for better performance
const ExportTable: React.FC<ExportTableProps> = React.memo(({ data }) => {
  const getDeliveryRateClass = (rate?: number) => {
    if (!rate) return "";
    if (rate >= 99.5) return "delivery-rate-high";
    if (rate >= 98) return "delivery-rate-medium";
    return "delivery-rate-low";
  };

  // Alternating row colors for better readability
  const getRowClass = (index: number) => {
    return index % 2 === 0 ? "row-even" : "row-odd";
  };

  // Shift display formatting
  const formatShift = (shift?: string) => {
    if (!shift || shift === "NONE") return "N/A";
    return shift;
  };

  return (
    <div className="overflow-auto max-h-[400px] border border-gray-300 rounded-md zoom-enabled">
      <table className="export-table">
        <thead>
          <tr>
            <th>Gaiola</th>
            <th>Cidade</th>
            <th>Driver planejado</th>
            <th>Taxa de Entrega</th>
            <th>Turno</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr key={rowIndex} className={getRowClass(rowIndex)}>
                <td className="font-bold">{row.gaiola}</td>
                <td>{row.cidade}</td>
                <td>{row.driver}</td>
                <td className={getDeliveryRateClass(row.taxaEntrega)}>
                  {row.taxaEntrega ? `${row.taxaEntrega.toFixed(2)}%` : "N/A"}
                </td>
                <td>{formatShift(row.shift)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="text-center py-4">
                Nenhum dado disponível com os filtros selecionados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});

export default ExportTable;
