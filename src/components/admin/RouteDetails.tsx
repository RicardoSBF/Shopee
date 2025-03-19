import React from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Package,
  Calendar,
  Truck,
  Map,
  Clock,
  X,
  Download,
  FileText,
  User,
} from "lucide-react";

interface RouteData {
  id: string;
  fileName: string;
  city: string;
  neighborhoods: string[];
  totalDistance: number;
  sequence: number;
  shift: "AM" | "PM" | "OUROBOROS";
  date: string;
  createdAt: string;
  assignedDriver?: string;
  deliveryRate?: number;
  isAssigned?: boolean;
  selected?: boolean;
  rawData?: any[];
}

interface RouteDetailsProps {
  route: RouteData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RouteDetails: React.FC<RouteDetailsProps> = ({
  route,
  open,
  onOpenChange,
}) => {
  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      return "Data inválida";
    }
  };

  // Formatar data e hora para exibição
  const formatDateTime = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return "Data inválida";
    }
  };

  // Obter a cor do badge do turno
  const getShiftBadgeClass = (shift: "AM" | "PM" | "OUROBOROS") => {
    switch (shift) {
      case "AM":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "PM":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "OUROBOROS":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-gradient-to-r from-orange-500 to-orange-600 -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
          <DialogTitle className="text-white flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Detalhes da Rota {route.fileName.split(" ").pop()}
          </DialogTitle>
          <DialogDescription className="text-orange-100">
            Informações detalhadas sobre a rota selecionada
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Informações básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 shadow-sm">
              <h3 className="text-lg font-bold text-orange-800 mb-3 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-orange-600" />
                Localização
              </h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <span className="font-medium text-gray-700 w-24">
                    Cidade:
                  </span>
                  <span className="text-gray-800">{route.city}</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium text-gray-700 w-24 mt-1">
                    Bairros:
                  </span>
                  <div className="flex-1">
                    <div className="bg-white p-2 rounded-md border border-orange-100 max-h-32 overflow-y-auto">
                      <ul className="space-y-1">
                        {route.neighborhoods.map((neighborhood, idx) => (
                          <li
                            key={idx}
                            className="flex items-center text-gray-800"
                          >
                            <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                            {neighborhood}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 shadow-sm">
              <h3 className="text-lg font-bold text-orange-800 mb-3 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-orange-600" />
                Informações da Rota
              </h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <span className="font-medium text-gray-700 w-24">Turno:</span>
                  <Badge
                    className={getShiftBadgeClass(route.shift)}
                    variant="outline"
                  >
                    {route.shift}
                  </Badge>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-700 w-24">Data:</span>
                  <span className="text-gray-800">
                    {formatDate(route.date)}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-700 w-24">
                    Distância:
                  </span>
                  <span className="text-gray-800">
                    {route.totalDistance.toFixed(1)} km
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-700 w-24">
                    Pacotes:
                  </span>
                  <span className="text-gray-800">
                    {route.rawData?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status da atribuição */}
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 shadow-sm">
            <h3 className="text-lg font-bold text-orange-800 mb-3 flex items-center">
              <User className="h-5 w-5 mr-2 text-orange-600" />
              Status da Atribuição
            </h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <span className="font-medium text-gray-700 w-24">Status:</span>
                {route.isAssigned ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    Atribuída
                  </Badge>
                ) : route.is_pending ? (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    Pendente
                  </Badge>
                ) : (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    Disponível
                  </Badge>
                )}
              </div>
              {route.isAssigned && (
                <div className="flex items-center">
                  <span className="font-medium text-gray-700 w-24">
                    Motorista:
                  </span>
                  <span className="text-gray-800">{route.assignedDriver}</span>
                </div>
              )}
              <div className="flex items-center">
                <span className="font-medium text-gray-700 w-24">
                  Criada em:
                </span>
                <span className="text-gray-800">
                  {formatDateTime(route.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Dados brutos (se disponíveis) */}
          {route.rawData && route.rawData.length > 0 && (
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 shadow-sm">
              <h3 className="text-lg font-bold text-orange-800 mb-3 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-orange-600" />
                Dados da Rota
              </h3>
              <div className="bg-white p-3 rounded-md border border-orange-100 max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-orange-200">
                  <thead className="bg-orange-50">
                    <tr>
                      {Object.keys(route.rawData[0] || {}).map((key) => (
                        <th
                          key={key}
                          className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-orange-100">
                    {route.rawData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-orange-50">
                        {Object.values(item).map((value: any, valueIdx) => (
                          <td
                            key={valueIdx}
                            className="px-3 py-2 whitespace-nowrap text-xs text-gray-700"
                          >
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="outline"
            className="border-orange-200 text-orange-700 hover:bg-orange-50"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>

          <Button
            variant="default"
            className="bg-orange-600 hover:bg-orange-700"
            onClick={() => {
              // Lógica para exportar dados da rota (se necessário)
              console.log("Exportar dados da rota", route.id);
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Dados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RouteDetails;
