import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Package,
  Route,
  Clock,
  Car,
  User,
  List,
  MapPinned,
  X,
  AlertTriangle,
  Search,
  Truck,
} from "lucide-react";

interface RouteDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  routeData: any;
}

interface Driver {
  id: string;
  name: string;
  vehicle_type: string;
  phone: string;
}

const RouteDetails: React.FC<RouteDetailsProps> = ({
  isOpen,
  onClose,
  routeData,
}) => {
  const [activeTab, setActiveTab] = useState("summary");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [selectedDriverDetails, setSelectedDriverDetails] =
    useState<Driver | null>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Buscar motoristas do banco de dados
  useEffect(() => {
    const fetchDrivers = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, vehicle_type, phone")
          .eq("is_admin", false);

        if (error) throw error;

        // Mapear os dados para o formato esperado
        const mappedDrivers = (data || []).map((driver) => ({
          id: driver.id,
          name: driver.full_name || "Sem nome",
          vehicle_type: driver.vehicle_type || "Não especificado",
          phone: driver.phone || "Sem telefone",
        }));

        setDrivers(mappedDrivers);
        setFilteredDrivers(mappedDrivers);
      } catch (error) {
        console.error("Erro ao buscar motoristas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrivers();
  }, []);

  // Filtrar motoristas quando o termo de busca mudar
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredDrivers(drivers);
      return;
    }

    const term = searchTerm.toLowerCase().trim();
    const filtered = drivers.filter(
      (driver) =>
        driver.name.toLowerCase().includes(term) ||
        driver.vehicle_type.toLowerCase().includes(term) ||
        driver.phone.toLowerCase().includes(term),
    );

    setFilteredDrivers(filtered);
  }, [searchTerm, drivers]);

  // Processar dados das paradas
  useEffect(() => {
    if (routeData && routeData.rawData) {
      // Agrupar paradas por número de parada (índice 1)
      const stopsMap = new Map();

      routeData.rawData.forEach((row: any, index: number) => {
        if (index === 0) return; // Pular linha de cabeçalho

        const stopNumber = row[1];
        const orderNumber = row[0];
        const address = row[6];
        const neighborhood = row[8];
        const zipCode = row[5];
        const trackingNumber = row[4];

        if (!stopsMap.has(stopNumber)) {
          stopsMap.set(stopNumber, []);
        }

        stopsMap.get(stopNumber).push({
          orderNumber,
          address,
          neighborhood,
          zipCode,
          trackingNumber,
        });
      });

      // Converter mapa para array
      const stopsArray = Array.from(stopsMap.entries()).map(
        ([stopNumber, addresses]) => ({
          stopNumber,
          addresses,
        }),
      );

      setStops(stopsArray);
    }
  }, [routeData]);

  // Lidar com a seleção de motorista
  const handleDriverSelect = (driverId: string) => {
    setSelectedDriver(driverId);
    const driver = drivers.find((d) => d.id === driverId) || null;
    setSelectedDriverDetails(driver);
  };

  // Lidar com a atribuição de rota
  const handleAssignRoute = async () => {
    if (!selectedDriver || !routeData) return;

    try {
      setIsLoading(true);
      // Atualizar rota no banco de dados
      const { error } = await supabase
        .from("routes")
        .update({
          assigned_driver: selectedDriverDetails?.name,
          driver_id: selectedDriver,
          vehicle_type: selectedDriverDetails?.vehicle_type,
          is_assigned: true,
        })
        .eq("id", routeData.id);

      if (error) throw error;

      // Fechar diálogo e atualizar rotas
      onClose();
      // Você pode adicionar um callback para atualizar a lista de rotas
    } catch (error) {
      console.error("Erro ao atribuir rota:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!routeData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-orange-500 mt-1" />
              <div>
                <DialogTitle className="text-xl">
                  Detalhes da Rota - {routeData.city}
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Visualize e gerencie os detalhes de atribuição da rota
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs
          defaultValue="summary"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-2"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Resumo da Rota</TabsTrigger>
            <TabsTrigger value="delivery">Detalhes de Entrega</TabsTrigger>
          </TabsList>

          {/* Aba de Resumo da Rota */}
          <TabsContent value="summary" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informações da Rota */}
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Informações da Rota</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-500">Cidade:</div>
                      <div className="font-medium">{routeData.city}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Route className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-500">Distância:</div>
                      <div className="font-medium">
                        {routeData.totalDistance} km
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-gray-500 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-500">Pacotes:</div>
                      <div className="font-medium">{routeData.sequence}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações de Status */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Informações de Status</h3>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-500">Status Atual:</div>
                    <Badge
                      className={`${routeData.isAssigned ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-orange-100 text-orange-800 hover:bg-orange-100"}`}
                    >
                      {routeData.isAssigned ? "Atribuída" : "Disponível"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">Atribuir Rota</h3>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-2">
                        Selecionar Motorista
                      </div>
                      <Select
                        value={selectedDriver}
                        onValueChange={handleDriverSelect}
                      >
                        <SelectTrigger className="w-full rounded-lg border-orange-200 focus:ring-orange-500 focus:border-orange-500 shadow-sm">
                          <SelectValue placeholder="Selecione um motorista" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-orange-200">
                          {drivers.length > 0 ? (
                            drivers.map((driver) => (
                              <SelectItem
                                key={driver.id}
                                value={driver.id}
                                className="hover:bg-orange-50"
                              >
                                <div className="flex justify-between items-center w-full">
                                  <span>{driver.name}</span>
                                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    {driver.vehicle_type}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-drivers" disabled>
                              Nenhum motorista disponível
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedDriverDetails && (
                      <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="h-4 w-4 text-orange-500" />
                          <span className="font-medium text-orange-700">
                            Motorista Selecionado
                          </span>
                        </div>
                        <div className="pl-6 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Nome:</span>
                            <span className="font-medium text-gray-800">
                              {selectedDriverDetails.name}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">
                              Veículo:
                            </span>
                            <span className="font-medium text-gray-800">
                              {selectedDriverDetails.vehicle_type}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">
                              Telefone:
                            </span>
                            <span className="font-medium text-gray-800">
                              {selectedDriverDetails.phone}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-6">
                      <Button variant="outline" onClick={onClose}>
                        Cancelar
                      </Button>
                      <Button
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={!selectedDriver || isLoading}
                        onClick={handleAssignRoute}
                      >
                        {isLoading ? "Atribuindo..." : "Atribuir Rota"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Aba de Detalhes de Entrega */}
          <TabsContent value="delivery" className="space-y-4 mt-4">
            <div>
              <h3 className="text-lg font-medium mb-4">
                Paradas e Endereços de Entrega
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Total de {stops.length} paradas com {routeData.sequence} pacotes
              </p>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {stops.map((stop, index) => (
                  <div
                    key={index}
                    className="border rounded-lg overflow-hidden"
                  >
                    <div className="bg-orange-50 p-3 flex items-center justify-between border-b">
                      <div className="flex items-center gap-2">
                        <div className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-medium">
                            Parada #{stop.stopNumber}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {stop.addresses.length} entregas
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y">
                      {stop.addresses.map((address: any, addrIndex: number) => (
                        <div key={addrIndex} className="p-3 hover:bg-gray-50">
                          <div className="flex items-start gap-2">
                            <div className="bg-gray-100 text-gray-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5">
                              {address.orderNumber}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">
                                {address.address}
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                  <MapPinned className="h-3.5 w-3.5" />
                                  {address.neighborhood}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {address.zipCode}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Rastreamento: {address.trackingNumber}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("summary")}
                >
                  Voltar para o Resumo
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default RouteDetails;
