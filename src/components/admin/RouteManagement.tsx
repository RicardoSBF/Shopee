import React from "react";
import RouteImport from "./RouteImport";
import AvailableRoutes from "./AvailableRoutes";
import { Route } from "lucide-react";

const RouteManagement = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
        <div className="text-left">
          <h2 className="text-3xl font-bold text-orange-700 mb-2 flex items-center gap-2">
            <Route className="h-7 w-7 text-orange-500" />
            Gerenciamento de Rotas
          </h2>
          <p className="text-gray-600 max-w-2xl">
            Importe e gerencie rotas de entrega para diferentes turnos e regiões
          </p>
        </div>
        <div className="flex-shrink-0">
          <RouteImport />
        </div>
      </div>

      <AvailableRoutes />
    </div>
  );
};

export default RouteManagement;
