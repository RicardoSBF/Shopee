import React, { useState, useEffect } from "react";
import RouteImport from "./RouteImport";
import AvailableRoutes from "./AvailableRoutes";
import { Route } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const RouteManagement = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-6 mb-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-orange-700 mb-2 flex items-center justify-center gap-2">
            <Route className="h-8 w-8 text-orange-500" />
            Gerenciamento de Rotas
          </h2>
          <p className="text-gray-600 max-w-2xl mb-6">
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
